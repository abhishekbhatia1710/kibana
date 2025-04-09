/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsType } from '@kbn/core-saved-objects-server';

export const ENTITY_WATCHLIST_SAVED_OBJECT_TYPE = 'entity_watchlist';

export const entityWatchlistSavedObjectType: SavedObjectsType = {
  name: ENTITY_WATCHLIST_SAVED_OBJECT_TYPE,
  hidden: false,
  namespaceType: 'multiple-isolated',
  mappings: {
    properties: {
      entity_id: { type: 'keyword' },
      entity_type: { type: 'keyword' },
      risk_score: { type: 'float' },
      risk_score_change: { type: 'float' },
      last_updated: { type: 'date' },
    },
  },
};
