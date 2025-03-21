/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { IUiSettingsClient, Capabilities } from '@kbn/core/public';
import type { DataPublicPluginStart } from '@kbn/data-plugin/public';
import type { FieldFormatsStart } from '@kbn/field-formats-plugin/public';
import type { LensPublicStart, TypedLensByValueInput, Suggestion } from '@kbn/lens-plugin/public';
import type { DataViewField } from '@kbn/data-views-plugin/public';
import type { RequestAdapter } from '@kbn/inspector-plugin/public';
import type { DefaultInspectorAdapters } from '@kbn/expressions-plugin/common';
import type { Subject } from 'rxjs';
import type { UiActionsStart } from '@kbn/ui-actions-plugin/public';
import type { Storage } from '@kbn/kibana-utils-plugin/public';
import type { ExpressionsStart } from '@kbn/expressions-plugin/public';
import { PublishingSubject } from '@kbn/presentation-publishing';

/**
 * The fetch status of a Unified Histogram request
 */
export enum UnifiedHistogramFetchStatus {
  uninitialized = 'uninitialized',
  loading = 'loading',
  partial = 'partial',
  complete = 'complete',
  error = 'error',
}

/**
 * The services required by the Unified Histogram components
 */
export interface UnifiedHistogramServices {
  data: DataPublicPluginStart;
  uiActions: UiActionsStart;
  uiSettings: IUiSettingsClient;
  fieldFormats: FieldFormatsStart;
  lens: LensPublicStart;
  storage: Storage;
  expressions: ExpressionsStart;
  capabilities: Capabilities;
}

/**
 * The bucketInterval object returned by {@link buildBucketInterval}
 */
export interface UnifiedHistogramBucketInterval {
  scaled?: boolean;
  description?: string;
  scale?: number;
}

/**
 * The adapters passed up from Lens
 */
export type UnifiedHistogramAdapters = Partial<DefaultInspectorAdapters>;

/**
 * Emitted when the histogram loading status changes
 */
export interface UnifiedHistogramChartLoadEvent {
  /**
   * Inspector adapters for the request
   */
  adapters: UnifiedHistogramAdapters;
  /**
   * Observable for the data change subscription
   */
  dataLoading$?: PublishingSubject<boolean | undefined>;
}

/**
 * Context object for requests made by Unified Histogram components
 */
export interface UnifiedHistogramRequestContext {
  /**
   * Current search session ID
   */
  searchSessionId?: string;
  /**
   * The adapter to use for requests (does not apply to Lens requests)
   */
  adapter?: RequestAdapter;
}

/**
 * Context object for the hits count
 */
export interface UnifiedHistogramHitsContext {
  /**
   * The fetch status of the hits count request
   */
  status?: UnifiedHistogramFetchStatus;
  /**
   * The total number of hits
   */
  total?: number;
}

/**
 * Context object for the chart
 */
export interface UnifiedHistogramChartContext {
  /**
   * Controls whether or not the chart is hidden
   */
  hidden?: boolean;
  /**
   * Controls the time interval of the chart
   */
  timeInterval?: string;
}

/**
 * Context object for the histogram breakdown
 */
export interface UnifiedHistogramBreakdownContext {
  /**
   * The field used for the breakdown
   */
  field?: DataViewField;
}

/**
 * Message to fetch the chart and total hits
 */
export interface UnifiedHistogramFetchMessage {
  type: 'fetch';
}

/**
 * Unified histogram input message
 */
export type UnifiedHistogramInputMessage = UnifiedHistogramFetchMessage;

/**
 * Unified histogram input observable
 */
export type UnifiedHistogramInput$ = Subject<UnifiedHistogramInputMessage>;

export enum UnifiedHistogramExternalVisContextStatus {
  unknown = 'unknown',
  applied = 'applied',
  automaticallyCreated = 'automaticallyCreated',
  automaticallyOverridden = 'automaticallyOverridden',
  manuallyCustomized = 'manuallyCustomized',
}

export enum UnifiedHistogramSuggestionType {
  unsupported = 'unsupported',
  lensSuggestion = 'lensSuggestion',
  histogramForESQL = 'histogramForESQL',
  histogramForDataView = 'histogramForDataView',
}

export interface UnifiedHistogramSuggestionContext {
  suggestion: Suggestion | undefined;
  type: UnifiedHistogramSuggestionType;
}

export interface LensRequestData {
  dataViewId?: string;
  timeField?: string;
  timeInterval?: string;
  breakdownField?: string;
}

/**
 * Unified Histogram type for recreating a stored Lens vis
 */
export interface UnifiedHistogramVisContext {
  attributes: TypedLensByValueInput['attributes'];
  requestData: LensRequestData;
  suggestionType: UnifiedHistogramSuggestionType;
}
