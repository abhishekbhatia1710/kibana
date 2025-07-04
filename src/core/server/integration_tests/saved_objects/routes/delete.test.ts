/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import supertest from 'supertest';
import { savedObjectsClientMock } from '@kbn/core-saved-objects-api-server-mocks';
import type { ICoreUsageStatsClient } from '@kbn/core-usage-data-base-server-internal';
import {
  coreUsageStatsClientMock,
  coreUsageDataServiceMock,
} from '@kbn/core-usage-data-server-mocks';
import {
  SetupServerReturn,
  createHiddenTypeVariants,
  setupServer,
} from '@kbn/core-test-helpers-test-utils';
import {
  registerDeleteRoute,
  type InternalSavedObjectsRequestHandlerContext,
} from '@kbn/core-saved-objects-server-internal';
import { loggerMock } from '@kbn/logging-mocks';
import { deprecationMock, setupConfig } from './routes_test_utils';

const testTypes = [
  { name: 'index-pattern', hide: false },
  { name: 'hidden-type', hide: true },
  { name: 'hidden-from-http', hide: false, hideFromHttpApis: true },
];

describe('DELETE /api/saved_objects/{type}/{id}', () => {
  let server: SetupServerReturn['server'];
  let createRouter: SetupServerReturn['createRouter'];
  let handlerContext: SetupServerReturn['handlerContext'];
  let savedObjectsClient: ReturnType<typeof savedObjectsClientMock.create>;
  let coreUsageStatsClient: jest.Mocked<ICoreUsageStatsClient>;
  let loggerWarnSpy: jest.SpyInstance;
  let registrationSpy: jest.SpyInstance;

  beforeEach(async () => {
    ({ server, createRouter, handlerContext } = await setupServer());
    savedObjectsClient = handlerContext.savedObjects.getClient();
    handlerContext.savedObjects.getClient = jest.fn().mockImplementation(() => savedObjectsClient);
    handlerContext.savedObjects.typeRegistry.getType.mockImplementation((typename: string) => {
      return testTypes
        .map((typeDesc) => createHiddenTypeVariants(typeDesc))
        .find((fullTest) => fullTest.name === typename);
    });

    const router = createRouter<InternalSavedObjectsRequestHandlerContext>('/api/saved_objects/');
    coreUsageStatsClient = coreUsageStatsClientMock.create();
    coreUsageStatsClient.incrementSavedObjectsDelete.mockRejectedValue(new Error('Oh no!')); // intentionally throw this error, which is swallowed, so we can assert that the operation does not fail
    const coreUsageData = coreUsageDataServiceMock.createSetupContract(coreUsageStatsClient);
    const logger = loggerMock.create();
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
    registrationSpy = jest.spyOn(router, 'delete');

    const config = setupConfig();
    const access = 'public';
    registerDeleteRoute(router, {
      config,
      coreUsageData,
      logger,
      access,
      deprecationInfo: deprecationMock,
    });

    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('formats successful response and records usage stats', async () => {
    const result = await supertest(server.listener)
      .delete('/api/saved_objects/index-pattern/logstash-*')
      .expect(200);

    expect(result.body).toEqual({});
    expect(coreUsageStatsClient.incrementSavedObjectsDelete).toHaveBeenCalledWith({
      request: expect.anything(),
      types: ['index-pattern'],
    });
  });

  it('calls upon savedObjectClient.delete', async () => {
    await supertest(server.listener)
      .delete('/api/saved_objects/index-pattern/logstash-*')
      .expect(200);

    expect(savedObjectsClient.delete).toHaveBeenCalledWith('index-pattern', 'logstash-*', {
      force: undefined,
    });
  });

  it('can specify `force` option', async () => {
    await supertest(server.listener)
      .delete('/api/saved_objects/index-pattern/logstash-*')
      .query({ force: true })
      .expect(200);

    expect(savedObjectsClient.delete).toHaveBeenCalledWith('index-pattern', 'logstash-*', {
      force: true,
    });
  });

  it('returns with status 400 if a type is hidden from the HTTP APIs', async () => {
    const result = await supertest(server.listener)
      .delete('/api/saved_objects/hidden-from-http/hiddenId')
      .expect(400);
    expect(result.body.message).toContain("Unsupported saved object type: 'hidden-from-http'");
  });

  it('returns with status 400 if a type is hidden from the HTTP APIs with `force` option', async () => {
    const result = await supertest(server.listener)
      .delete('/api/saved_objects/hidden-from-http/hiddenId')
      .query({ force: true })
      .expect(400);
    expect(result.body.message).toContain("Unsupported saved object type: 'hidden-from-http'");
  });

  it('logs a warning message when called', async () => {
    await supertest(server.listener)
      .delete('/api/saved_objects/index-pattern/logstash-*')
      .expect(200);
    expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('passes deprecation configuration to the router arguments', async () => {
    await supertest(server.listener)
      .delete('/api/saved_objects/index-pattern/logstash-*')
      .expect(200);
    expect(registrationSpy.mock.calls[0][0]).toMatchObject({
      options: { deprecated: deprecationMock },
    });
  });
});
