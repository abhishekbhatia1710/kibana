/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IEsSearchResponse } from '@kbn/search-types';
import { getOr } from 'lodash/fp';
import type { SearchHit } from '@elastic/elasticsearch/lib/api/types';
import type { EventEnrichmentRequestOptions } from '../../../../../../common/api/search_strategy';
import { inspectStringifyObject } from '../../../../../utils/build_query';
import { buildIndicatorEnrichments, getTotalCount } from './helpers';
import { buildEventEnrichmentQuery } from './query';

export const parseEventEnrichmentResponse = async (
  options: EventEnrichmentRequestOptions,
  response: IEsSearchResponse
) => {
  const inspect = {
    dsl: [inspectStringifyObject(buildEventEnrichmentQuery(options))],
  };
  const totalCount = getTotalCount(response.rawResponse.hits.total);
  const hits: SearchHit[] = getOr([], 'rawResponse.hits.hits', response);
  const enrichments = buildIndicatorEnrichments(hits);

  return {
    ...response,
    enrichments,
    inspect,
    totalCount,
  };
};
