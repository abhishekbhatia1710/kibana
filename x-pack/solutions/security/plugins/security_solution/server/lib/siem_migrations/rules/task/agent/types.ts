/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/core/server';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { RuleMigrationsRetriever } from '../retrievers';
import type { EsqlKnowledgeBase } from '../util/esql_knowledge_base';
import type { SiemMigrationTelemetryClient } from '../rule_migrations_telemetry_client';
import type { ChatModel } from '../util/actions_client_chat';
import type { migrateRuleConfigSchema, migrateRuleState } from './state';

export type MigrateRuleState = typeof migrateRuleState.State;
export type MigrateRuleGraphConfig = RunnableConfig<(typeof migrateRuleConfigSchema)['State']>;
export type GraphNode = (
  state: MigrateRuleState,
  config: MigrateRuleGraphConfig
) => Promise<Partial<MigrateRuleState>>;

export interface RuleMigrationAgentRunOptions {
  skipPrebuiltRulesMatching: boolean;
}

export interface MigrateRuleGraphParams {
  esqlKnowledgeBase: EsqlKnowledgeBase;
  model: ChatModel;
  ruleMigrationsRetriever: RuleMigrationsRetriever;
  logger: Logger;
  telemetryClient: SiemMigrationTelemetryClient;
}
