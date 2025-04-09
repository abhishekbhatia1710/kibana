/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsClientContract } from '@kbn/core/server';
import { entityWatchlistSavedObjectType } from './saved_object';

interface WatchlistEntry {
  entity_id: string;
  entity_type: 'user' | 'host' | 'service';
  risk_score: number;
  risk_score_change?: number;
  last_updated: string;
}

export const addToWatchlist = async (
  soClient: SavedObjectsClientContract,
  entry: WatchlistEntry
) => {
  return await soClient.create(entityWatchlistSavedObjectType.name, entry);
};

export const removeFromWatchlist = async (soClient: SavedObjectsClientContract, id: string) => {
  return soClient.delete(entityWatchlistSavedObjectType.name, id);
};

export const getWatchlist = async (soClient: SavedObjectsClientContract) => {
  const res = await soClient.find<WatchlistEntry>({
    type: entityWatchlistSavedObjectType.name,
    perPage: 1000,
  });
  return res.saved_objects.map((obj) => ({ id: obj.id, ...obj.attributes }));
};

export const isEntityInWatchlist = async (
  soClient: SavedObjectsClientContract,
  entityId: string
) => {
  const res = await soClient.find<WatchlistEntry>({
    type: entityWatchlistSavedObjectType.name,
    search: entityId,
    searchFields: ['entity_id'],
  });
  return res.total > 0;
};
