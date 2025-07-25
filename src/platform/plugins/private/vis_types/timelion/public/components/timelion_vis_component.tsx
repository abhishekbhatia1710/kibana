/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { compact, last, map } from 'lodash';
import {
  Chart,
  Settings,
  Position,
  Axis,
  TooltipType,
  LegendPositionConfig,
  LayoutDirection,
  Placement,
  Tooltip,
  LegendValue,
  BrushEndListener,
} from '@elastic/charts';
import { EuiTitle } from '@elastic/eui';
import { RangeFilterParams } from '@kbn/es-query';

import { useKibana } from '@kbn/kibana-react-plugin/public';
import { useActiveCursor } from '@kbn/charts-plugin/public';

import type { IInterpreterRenderHandlers } from '@kbn/expressions-plugin/common';
import { i18n } from '@kbn/i18n';
import { css } from '@emotion/react';
import { AreaSeriesComponent, BarSeriesComponent } from './series';

import {
  extractAllYAxis,
  withStaticPadding,
  createTickFormat,
  validateLegendPositionValue,
  MAIN_GROUP_ID,
} from '../helpers/panel_utils';

import { colors } from '../helpers/chart_constants';
import { getCharts, getFieldFormats } from '../helpers/plugin_services';

import type { Series, Sheet } from '../helpers/timelion_request_handler';
import type { TimelionVisDependencies } from '../plugin';

declare global {
  interface Window {
    /**
     * Flag used to enable debugState on elastic charts
     */
    _echDebugStateFlag?: boolean;
  }
}

interface TimelionVisComponentProps {
  interval: string;
  seriesList: Sheet;
  onBrushEvent: (rangeFilterParams: RangeFilterParams) => void;
  renderComplete: IInterpreterRenderHandlers['done'];
  ariaLabel?: string;
  syncTooltips?: boolean;
  syncCursor?: boolean;
}

const DefaultYAxis = () => (
  <Axis
    id="left"
    domain={withStaticPadding({
      fit: false,
      min: NaN,
      max: NaN,
    })}
    position={Position.Left}
    groupId={`${MAIN_GROUP_ID}`}
  />
);

const renderYAxis = (series: Series[]) => {
  const yAxisOptions = extractAllYAxis(series);
  const defaultFormatter = (x: unknown) => {
    return getFieldFormats().getInstance('number').convert(x);
  };
  const yAxis = yAxisOptions.map((option, index) => (
    <Axis
      groupId={option.groupId}
      key={index}
      id={option.id!}
      title={option.title}
      position={option.position}
      tickFormat={option.tickFormat || defaultFormatter}
      gridLine={{
        visible: !index,
      }}
      domain={option.domain}
    />
  ));

  return yAxis.length ? yAxis : <DefaultYAxis />;
};

const timelionStyles = {
  base: css({
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  }),
  topTitle: css({
    textAlign: 'center',
  }),
};

export const TimelionVisComponent = ({
  interval,
  seriesList,
  renderComplete,
  onBrushEvent,
  ariaLabel,
  syncTooltips,
  syncCursor,
}: TimelionVisComponentProps) => {
  const kibana = useKibana<TimelionVisDependencies>();
  const chartRef = useRef<Chart>(null);
  const chart = seriesList.list;
  const chartsService = getCharts();
  const chartBaseTheme = chartsService.theme.useChartsBaseTheme();

  const handleCursorUpdate = useActiveCursor(chartsService.activeCursor, chartRef, {
    isDateHistogram: true,
  });

  const brushEndListener = useCallback<BrushEndListener>(
    ({ x }) => {
      if (!x) {
        return;
      }

      onBrushEvent({
        gte: x[0],
        lte: x[1],
      });
    },
    [onBrushEvent]
  );

  const onRenderChange = useCallback(
    (isRendered: boolean) => {
      if (isRendered) {
        renderComplete();
      }
    },
    [renderComplete]
  );

  const title: string = useMemo(
    () => last(compact(map(seriesList.list, '_title'))) || '',
    [seriesList.list]
  );

  const tickFormat = useMemo(
    () => createTickFormat(interval, kibana.services.timefilter, kibana.services.uiSettings),
    [interval, kibana.services.timefilter, kibana.services.uiSettings]
  );

  const legend = useMemo(() => {
    const legendPosition: LegendPositionConfig = {
      floating: true,
      floatingColumns: 1,
      vAlign: Position.Top,
      hAlign: Position.Left,
      direction: LayoutDirection.Vertical,
    };
    let showLegend = true;

    chart.forEach((series) => {
      if (series._global?.legend) {
        const {
          show = true,
          position,
          noColumns = legendPosition.floatingColumns,
        } = series._global?.legend ?? {};

        if (validateLegendPositionValue(position)) {
          const [vAlign, hAlign] = position.split('');

          legendPosition.vAlign = vAlign === 'n' ? Position.Top : Position.Bottom;
          legendPosition.hAlign = hAlign === 'e' ? Position.Right : Position.Left;
        }

        if (!show) {
          showLegend = false;
        }

        if (noColumns !== undefined) {
          legendPosition.floatingColumns = noColumns;
        }
      }
    });

    return { legendPosition, showLegend };
  }, [chart]);

  return (
    <div className="timelionChart" data-test-subj="timelionChart" css={timelionStyles.base}>
      {title && (
        <EuiTitle size="xxxs" css={timelionStyles.topTitle}>
          <h4>{title}</h4>
        </EuiTitle>
      )}
      <Chart ref={chartRef} renderer="canvas" size={{ width: '100%' }}>
        <Tooltip
          snap={true}
          headerFormatter={({ value }) => tickFormat(value)}
          type={TooltipType.VerticalCursor}
        />
        <Settings
          debugState={window._echDebugStateFlag ?? false}
          onBrushEnd={brushEndListener}
          showLegend={legend.showLegend}
          legendValues={[LegendValue.CurrentAndLastValue]}
          legendPosition={legend.legendPosition}
          onRenderChange={onRenderChange}
          onPointerUpdate={syncCursor ? handleCursorUpdate : undefined}
          externalPointerEvents={{
            tooltip: { visible: syncTooltips, placement: Placement.Right },
          }}
          baseTheme={chartBaseTheme}
          ariaLabel={ariaLabel}
          ariaUseDefaultSummary={!ariaLabel}
          locale={i18n.getLocale()}
        />

        <Axis
          id="bottom"
          position={Position.Bottom}
          showOverlappingTicks
          tickFormat={tickFormat}
          gridLine={{ visible: false }}
        />

        {renderYAxis(chart)}

        {chart.map((data, index) => {
          const visData = { ...data };
          const SeriesComponent = data.bars ? BarSeriesComponent : AreaSeriesComponent;

          if (!visData.color) {
            visData.color = colors[index % colors.length];
          }
          return (
            <SeriesComponent
              key={`${index}-${visData.label}`}
              visData={visData}
              index={chart.length - index}
              groupId={`${visData.yaxis ? visData.yaxis : MAIN_GROUP_ID}`}
            />
          );
        })}
      </Chart>
    </div>
  );
};
