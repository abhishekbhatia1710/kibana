/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger, IRouter } from '@kbn/core/server';
import { timeSeriesQuery } from './lib/time_series_query';
import { registerRoutes } from './routes';

export type { TimeSeriesQuery } from './lib';
export { TIME_SERIES_BUCKET_SELECTOR_FIELD } from './lib';

// future enhancement: make these configurable?
export const DEFAULT_GROUPS = 100;

export function getService() {
  return {
    timeSeriesQuery,
  };
}

interface RegisterParams {
  logger: Logger;
  router: IRouter;
  data: ReturnType<typeof getService>;
  baseRoute: string;
}

export function register(params: RegisterParams) {
  const { logger, router, data, baseRoute } = params;
  const baseBuiltInRoute = `${baseRoute}/data`;
  registerRoutes({ logger, router, data, baseRoute: baseBuiltInRoute });
}
