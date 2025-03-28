/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  ObservabilityPublicSetup,
  ObservabilityPublicStart,
} from '@kbn/observability-plugin/public';
import {
  ObservabilitySharedPluginSetup,
  ObservabilitySharedPluginStart,
} from '@kbn/observability-shared-plugin/public';
import {
  AppMountParameters,
  CoreSetup,
  CoreStart,
  DEFAULT_APP_CATEGORIES,
  Plugin,
  PluginInitializerContext,
} from '@kbn/core/public';
import { DataPublicPluginSetup, DataPublicPluginStart } from '@kbn/data-plugin/public';
import { SharePluginSetup, SharePluginStart } from '@kbn/share-plugin/public';
import { DiscoverSetup, DiscoverStart } from '@kbn/discover-plugin/public';
import { FleetSetup, FleetStart } from '@kbn/fleet-plugin/public';
import { CloudSetup, CloudStart } from '@kbn/cloud-plugin/public';
import { UsageCollectionSetup, UsageCollectionStart } from '@kbn/usage-collection-plugin/public';
import type { ObservabilityOnboardingConfig } from '../server';
import { PLUGIN_ID } from '../common';
import { ObservabilityOnboardingLocatorDefinition } from './locators/onboarding_locator/locator_definition';
import { ObservabilityOnboardingPluginLocators } from './locators';
import { ConfigSchema } from '.';
import {
  OBSERVABILITY_ONBOARDING_FEEDBACK_TELEMETRY_EVENT,
  OBSERVABILITY_ONBOARDING_TELEMETRY_EVENT,
  OBSERVABILITY_ONBOARDING_FLOW_PROGRESS_TELEMETRY_EVENT,
  OBSERVABILITY_ONBOARDING_FLOW_ERROR_TELEMETRY_EVENT,
  OBSERVABILITY_ONBOARDING_FLOW_DATASET_DETECTED_TELEMETRY_EVENT,
} from '../common/telemetry_events';

export type ObservabilityOnboardingPluginSetup = void;
export type ObservabilityOnboardingPluginStart = void;

export interface ObservabilityOnboardingPluginSetupDeps {
  data: DataPublicPluginSetup;
  observability: ObservabilityPublicSetup;
  observabilityShared: ObservabilitySharedPluginSetup;
  discover: DiscoverSetup;
  share: SharePluginSetup;
  fleet: FleetSetup;
  cloud?: CloudSetup;
  usageCollection?: UsageCollectionSetup;
}

export interface ObservabilityOnboardingPluginStartDeps {
  data: DataPublicPluginStart;
  observability: ObservabilityPublicStart;
  observabilityShared: ObservabilitySharedPluginStart;
  discover: DiscoverStart;
  share: SharePluginStart;
  fleet: FleetStart;
  cloud?: CloudStart;
  usageCollection?: UsageCollectionStart;
}

export type ObservabilityOnboardingContextValue = CoreStart &
  ObservabilityOnboardingPluginStartDeps & { config: ConfigSchema };

export class ObservabilityOnboardingPlugin
  implements Plugin<ObservabilityOnboardingPluginSetup, ObservabilityOnboardingPluginStart>
{
  private locators?: ObservabilityOnboardingPluginLocators;

  constructor(private readonly ctx: PluginInitializerContext) {}

  public setup(core: CoreSetup, plugins: ObservabilityOnboardingPluginSetupDeps) {
    const stackVersion = this.ctx.env.packageInfo.version;
    const config = this.ctx.config.get<ObservabilityOnboardingConfig>();
    const isServerlessBuild = this.ctx.env.packageInfo.buildFlavor === 'serverless';
    const isDevEnvironment = this.ctx.env.mode.dev;
    const pluginSetupDeps = plugins;

    core.application.register({
      id: PLUGIN_ID,
      title: 'Observability Onboarding',
      order: 8500,
      euiIconType: 'logoObservability',
      category: DEFAULT_APP_CATEGORIES.observability,
      keywords: ['add data'],
      async mount(appMountParameters: AppMountParameters) {
        // Load application bundle and Get start service
        const [{ renderApp }, [coreStart, corePlugins]] = await Promise.all([
          import('./application/app'),
          core.getStartServices(),
        ]);

        const { createCallApi } = await import('./services/rest/create_call_api');

        createCallApi(core);

        return renderApp({
          core: coreStart,
          deps: pluginSetupDeps,
          appMountParameters,
          corePlugins: corePlugins as ObservabilityOnboardingPluginStartDeps,
          config,
          context: {
            isDev: isDevEnvironment,
            isCloud: Boolean(pluginSetupDeps.cloud?.isCloudEnabled),
            isServerless: Boolean(pluginSetupDeps.cloud?.isServerlessEnabled) || isServerlessBuild,
            stackVersion,
            cloudServiceProvider: pluginSetupDeps.cloud?.csp,
          },
        });
      },
      visibleIn: ['globalSearch'],
    });

    this.locators = {
      onboarding: plugins.share.url.locators.create(new ObservabilityOnboardingLocatorDefinition()),
    };

    core.analytics.registerEventType(OBSERVABILITY_ONBOARDING_TELEMETRY_EVENT);
    core.analytics.registerEventType(OBSERVABILITY_ONBOARDING_FEEDBACK_TELEMETRY_EVENT);
    core.analytics.registerEventType(OBSERVABILITY_ONBOARDING_FLOW_PROGRESS_TELEMETRY_EVENT);
    core.analytics.registerEventType(OBSERVABILITY_ONBOARDING_FLOW_ERROR_TELEMETRY_EVENT);
    core.analytics.registerEventType(
      OBSERVABILITY_ONBOARDING_FLOW_DATASET_DETECTED_TELEMETRY_EVENT
    );

    return {
      locators: this.locators,
      getLocator: () => this.locators?.onboarding,
    };
  }
  public start(_core: CoreStart, _plugins: ObservabilityOnboardingPluginStartDeps) {
    return {
      locators: this.locators,
    };
  }
}
