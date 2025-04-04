/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AssistantTelemetryEvent } from './types';
import { AssistantEventTypes } from './types';

export const assistantInvokedEvent: AssistantTelemetryEvent = {
  eventType: AssistantEventTypes.AssistantInvoked,
  schema: {
    invokedBy: {
      type: 'keyword',
      _meta: {
        description: 'Invocation method',
        optional: false,
      },
    },
  },
};

export const assistantMessageSentEvent: AssistantTelemetryEvent = {
  eventType: AssistantEventTypes.AssistantMessageSent,
  schema: {
    role: {
      type: 'keyword',
      _meta: {
        description: 'Conversation role',
        optional: false,
      },
    },
    actionTypeId: {
      type: 'keyword',
      _meta: {
        description: 'Kibana connector type',
        optional: false,
      },
    },
    model: {
      type: 'keyword',
      _meta: {
        description: 'LLM model',
        optional: true,
      },
    },
    provider: {
      type: 'keyword',
      _meta: {
        description: 'OpenAI provider',
        optional: true,
      },
    },
    isEnabledKnowledgeBase: {
      type: 'boolean',
      _meta: {
        description: 'Is knowledge base enabled',
      },
    },
  },
};

export const assistantQuickPrompt: AssistantTelemetryEvent = {
  eventType: AssistantEventTypes.AssistantQuickPrompt,
  schema: {
    promptTitle: {
      type: 'keyword',
      _meta: {
        description: 'Title of the quick prompt',
        optional: false,
      },
    },
  },
};

export const assistantSettingToggledEvent: AssistantTelemetryEvent = {
  eventType: AssistantEventTypes.AssistantSettingToggled,
  schema: {
    alertsCountUpdated: {
      type: 'boolean',
      _meta: {
        description: 'Did alerts count update',
        optional: true,
      },
    },
    assistantStreamingEnabled: {
      type: 'boolean',
      _meta: {
        description: 'Is streaming enabled',
        optional: true,
      },
    },
  },
};

export const assistantTelemetryEvents = [
  assistantInvokedEvent,
  assistantMessageSentEvent,
  assistantQuickPrompt,
  assistantSettingToggledEvent,
];
