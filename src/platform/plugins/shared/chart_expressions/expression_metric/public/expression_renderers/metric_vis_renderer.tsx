/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';

import { KibanaRenderContextProvider } from '@kbn/react-kibana-context-render';
import { ExpressionRenderDefinition } from '@kbn/expressions-plugin/common/expression_renderers';
import { css } from '@emotion/react';
import { StartServicesGetter } from '@kbn/kibana-utils-plugin/public';
import { METRIC_TYPE } from '@kbn/analytics';
import {
  createPerformanceTracker,
  PERFORMANCE_TRACKER_MARKS,
  PERFORMANCE_TRACKER_TYPES,
} from '@kbn/ebt-tools';
import type { IInterpreterRenderHandlers, Datatable } from '@kbn/expressions-plugin/common';
import { getColumnByAccessor } from '@kbn/visualizations-plugin/common/utils';
import { extractContainerType, extractVisualizationType } from '@kbn/chart-expressions-common';
import { ExpressionMetricPluginStart } from '../plugin';
import { EXPRESSION_METRIC_NAME, MetricVisRenderConfig, VisParams } from '../../common';

async function metricFilterable(
  dimensions: VisParams['dimensions'],
  table: Datatable,
  hasCompatibleActions?: IInterpreterRenderHandlers['hasCompatibleActions']
) {
  const column = getColumnByAccessor(dimensions.breakdownBy ?? dimensions.metric, table.columns);
  const colIndex = table.columns.indexOf(column!);
  const value = column ? table.rows[0][column.id] : undefined;
  return Boolean(
    await hasCompatibleActions?.({
      name: 'filter',
      data: {
        data: [
          {
            table,
            column: colIndex,
            row: 0,
            value,
          },
        ],
      },
    })
  );
}
interface ExpressionMetricVisRendererDependencies {
  getStartDeps: StartServicesGetter<ExpressionMetricPluginStart>;
}

export const getMetricVisRenderer = (
  deps: ExpressionMetricVisRendererDependencies
): (() => ExpressionRenderDefinition<MetricVisRenderConfig>) => {
  return () => ({
    name: EXPRESSION_METRIC_NAME,
    displayName: 'metric visualization',
    reuseDomNode: true,
    render: async (domNode, { visData, visConfig, overrides }, handlers) => {
      const performanceTracker = createPerformanceTracker({
        type: PERFORMANCE_TRACKER_TYPES.PANEL,
        subType: EXPRESSION_METRIC_NAME,
      });

      performanceTracker.mark(PERFORMANCE_TRACKER_MARKS.PRE_RENDER);

      const { core, plugins } = deps.getStartDeps();

      handlers.onDestroy(() => {
        unmountComponentAtNode(domNode);
      });

      const filterable = visData.rows.length
        ? await metricFilterable(
            visConfig.dimensions,
            visData,
            handlers.hasCompatibleActions?.bind(handlers)
          )
        : false;

      const renderComplete = () => {
        performanceTracker.mark(PERFORMANCE_TRACKER_MARKS.RENDER_COMPLETE);

        const executionContext = handlers.getExecutionContext();
        const containerType = extractContainerType(executionContext);
        const visualizationType = extractVisualizationType(executionContext);

        if (containerType && visualizationType) {
          plugins.usageCollection?.reportUiCounter(containerType, METRIC_TYPE.COUNT, [
            `render_${visualizationType}_metric`,
          ]);
        }

        handlers.done();
      };

      const { MetricVis } = await import('../components/metric_vis');

      performanceTracker.mark(PERFORMANCE_TRACKER_MARKS.RENDER_START);

      render(
        <KibanaRenderContextProvider {...core}>
          <div
            data-test-subj="mtrVis"
            css={css`
              height: 100%;
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            `}
          >
            <MetricVis
              data={visData}
              config={visConfig}
              renderComplete={renderComplete}
              fireEvent={handlers.event}
              filterable={filterable}
              overrides={overrides}
            />
          </div>
        </KibanaRenderContextProvider>,
        domNode
      );
    },
  });
};
