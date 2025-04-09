/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/core/server';
import { buildSiemResponse } from '@kbn/lists-plugin/server/routes/utils';
import type { EntityAnalyticsRoutesDeps } from '../types';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from './service';

export function registerWatchlistRoutes(
  router: EntityAnalyticsRoutesDeps['router'],
  logger: Logger
) {
  // GET the watchlist
  router.get(
    {
      path: '/api/entity_analytics/entity/watchlist',
      security: {
        authz: {
          requiredPrivileges: ['securitySolution', 'securitySolution-entity-analytics'],
        },
      },
      validate: false,
    },
    async (context, request, response) => {
      const siemResponse = buildSiemResponse(response);
      // const securityContext = await context.securitySolution;
      const coreContext = await context.core;
      const soClient = coreContext.savedObjects.client;
      try {
        const watchlist = await getWatchlist(soClient); // Replace with actual logic to fetch the watchlist
        return response.ok({
          body: { watchlist },
        });
      } catch (error) {
        return siemResponse.error({
          statusCode: 500,
          body: { message: 'Failed to fetch the watchlist' },
        });
      }
    }
  );

  // Add an entity to the watchlist
  router.post(
    {
      path: '/api/entity_analytics/entity/watchlist',
      security: {
        authz: {
          requiredPrivileges: ['securitySolution', 'securitySolution-entity-analytics'],
        },
      },
      validate: false,
    },
    async (context, request, response) => {
      const siemResponse = buildSiemResponse(response);
      // const securityContext = await context.securitySolution;
      const coreContext = await context.core;
      const soClient = coreContext.savedObjects.client;
      try {
        const entity_id = request.body.entity_id; // Assuming the entity ID is passed in the request body
        const entity_type = request.body.entity_type; // Assuming the entity type is passed in the request body
        const risk_score = request.body.risk_score; // Assuming the risk score is passed in the request body
        const last_updated = new Date().toISOString(); // Current date and time
        const entry = {
          entity_id,
          entity_type,
          risk_score,
          last_updated,
        };
        const watchlist = await addToWatchlist(soClient, entry); // Replace with actual logic to fetch the watchlist
        return response.ok({
          body: { watchlist },
        });
      } catch (error) {
        return siemResponse.error({
          statusCode: 500,
          body: { message: 'Failed to add data to the watchlist', error },
        });
      }
    }
  );

  router.delete(
    {
      path: '/api/entity_analytics/entity/watchlist/{entityId}',
      security: {
        authz: {
          requiredPrivileges: ['securitySolution', 'securitySolution-entity-analytics'],
        },
      },
      validate: false,
    },
    async (context, request, response) => {
      const siemResponse = buildSiemResponse(response);
      // const securityContext = await context.securitySolution;
      const coreContext = await context.core;
      const soClient = coreContext.savedObjects.client;
      try {
        const { entityId } = request.params;
        const watchlist = await removeFromWatchlist(soClient, entityId); // Replace with actual logic to fetch the watchlist
        return response.ok({
          body: { watchlist },
        });
      } catch (error) {
        return siemResponse.error({
          statusCode: 500,
          body: { message: 'Failed to delete to the watchlist', error },
        });
      }
    }
  );
}
