/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { registryMock, managerMock } from './plugin.test.mocks';
import { SharePlugin } from './plugin';
import { coreMock } from '@kbn/core/public/mocks';
import { licensingMock } from '@kbn/licensing-plugin/public/mocks';
import { anonymousAccessMock } from '../common/anonymous_access/index.mock';

const licensingStartMock = licensingMock.createStart();

describe('SharePlugin', () => {
  beforeEach(() => {
    managerMock.start.mockClear();
    registryMock.setup.mockClear();
    registryMock.start.mockClear();
  });

  describe('setup', () => {
    test('wires up and returns registry', async () => {
      const coreSetup = coreMock.createSetup();
      const setup = new SharePlugin(
        coreMock.createPluginInitializerContext({
          new_version: {
            enabled: false,
          },
        })
      ).setup(coreSetup);
      expect(registryMock.setup).toHaveBeenCalledWith();
      expect(setup.register).toBeDefined();
    });

    test('registers redirect app', async () => {
      const coreSetup = coreMock.createSetup();
      await new SharePlugin(
        coreMock.createPluginInitializerContext({
          new_version: {
            enabled: false,
          },
        })
      ).setup(coreSetup);
      expect(coreSetup.application.register).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'short_url_redirect',
        })
      );
    });
  });

  describe('start', () => {
    describe('share menu', () => {
      test('wires up and returns show function, but not registry', async () => {
        const coreSetup = coreMock.createSetup();
        const service = new SharePlugin(
          coreMock.createPluginInitializerContext({
            new_version: {
              enabled: false,
            },
          })
        );
        await service.setup(coreSetup);
        const start = await service.start(coreMock.createStart(), {
          licensing: licensingStartMock,
        });
        expect(registryMock.start).toHaveBeenCalled();
        expect(managerMock.start).toHaveBeenCalledWith({
          resolveShareItemsForShareContext: expect.any(Function),
          core: expect.objectContaining({}),
          isServerless: expect.any(Boolean),
        });
        expect(start.toggleShareContextMenu).toBeDefined();
      });

      test('passes anonymous access service provider to the share menu manager when it is available', async () => {
        const coreSetup = coreMock.createSetup();
        const service = new SharePlugin(
          coreMock.createPluginInitializerContext({
            new_version: {
              enabled: false,
            },
          })
        );
        const setup = await service.setup(coreSetup);
        const anonymousAccessServiceProvider = () => anonymousAccessMock.create();
        setup.setAnonymousAccessServiceProvider(anonymousAccessServiceProvider);
        const start = await service.start(coreMock.createStart(), {
          licensing: licensingStartMock,
        });
        expect(registryMock.start).toHaveBeenCalled();
        expect(managerMock.start).toHaveBeenCalledWith({
          resolveShareItemsForShareContext: expect.any(Function),
          core: expect.objectContaining({}),
          isServerless: expect.any(Boolean),
        });
        expect(start.toggleShareContextMenu).toBeDefined();
      });
    });
  });
});
