/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { get, map } from 'lodash';
import { ElasticsearchClient, SavedObjectsClientContract } from '@kbn/core/server';
import type { estypes } from '@elastic/elasticsearch';
import { getFieldSubtypeNested } from '@kbn/data-plugin/common';
import type { FieldSpec } from '@kbn/data-views-plugin/common';
import { ConfigSchema } from '../config';
import { findIndexPatternById, getFieldByName } from '../data_views';

export async function termsAggSuggestions(
  config: ConfigSchema,
  savedObjectsClient: SavedObjectsClientContract,
  esClient: ElasticsearchClient,
  index: string,
  fieldName: string,
  query: string,
  filters?: estypes.QueryDslQueryContainer[],
  field?: FieldSpec,
  abortSignal?: AbortSignal
) {
  const autocompleteSearchOptions = {
    timeout: `${config.autocomplete.valueSuggestions.timeout.asMilliseconds()}ms`,
    terminate_after: config.autocomplete.valueSuggestions.terminateAfter.asMilliseconds(),
  };

  if (!field?.name && !field?.type) {
    const indexPattern = await findIndexPatternById(savedObjectsClient, index);

    field = indexPattern && getFieldByName(fieldName, indexPattern);
  }

  // Terms agg doesn't support IP with "exclude"/"include" parameter
  if (field?.type === 'ip') {
    return [];
  }

  const body = await getBody(autocompleteSearchOptions, field ?? fieldName, query, filters);

  const result = await esClient.search(
    { index, ...body },
    {
      signal: abortSignal,
    }
  );

  const buckets =
    get(result, 'aggregations.suggestions.buckets') ||
    get(result, 'aggregations.nestedSuggestions.suggestions.buckets');

  return map(buckets ?? [], 'key');
}

async function getBody(
  // eslint-disable-next-line @typescript-eslint/naming-convention
  { timeout, terminate_after }: Record<string, any>,
  field: FieldSpec | string,
  query: string,
  filters: estypes.QueryDslQueryContainer[] = []
) {
  const isFieldObject = (f: any): f is FieldSpec => Boolean(f && f.name);

  // https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-regexp-query.html#_standard_operators
  const getEscapedQuery = (q: string = '') =>
    q.replace(/[.?+*|{}[\]()"\\#@&<>~]/g, (match) => `\\${match}`);

  // Helps ensure that the regex is not evaluated eagerly against the terms dictionary
  const executionHint = 'map' as const;

  // We don't care about the accuracy of the counts, just the content of the terms, so this reduces
  // the amount of information that needs to be transmitted to the coordinating node
  const shardSize = 10;
  const body = {
    size: 0,
    timeout,
    terminate_after,
    query: {
      bool: {
        filter: filters,
      },
    },
    aggs: {
      suggestions: {
        terms: {
          field: isFieldObject(field) ? field.name : field,
          include: `${getEscapedQuery(query)}.*`,
          execution_hint: executionHint,
          shard_size: shardSize,
        },
      },
    },
  };
  const subTypeNested = isFieldObject(field) && getFieldSubtypeNested(field);
  if (isFieldObject(field) && subTypeNested) {
    return {
      ...body,
      aggs: {
        nestedSuggestions: {
          nested: {
            path: subTypeNested.nested.path,
          },
          aggs: body.aggs,
        },
      },
    };
  }

  return body;
}
