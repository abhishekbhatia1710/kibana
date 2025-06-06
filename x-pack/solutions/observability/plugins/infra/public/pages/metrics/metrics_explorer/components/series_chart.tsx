/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { RecursivePartial, AreaSeriesStyle, BarSeriesStyle } from '@elastic/charts';
import { ScaleType, AreaSeries, BarSeries } from '@elastic/charts';
import type { MetricsExplorerSeries } from '../../../../../common/http_api/metrics_explorer';
import { colorTransformer, Color } from '../../../../../common/color_palette';
import { createMetricLabel } from './helpers/create_metric_label';
import type { MetricsExplorerOptionsMetric } from '../hooks/use_metrics_explorer_options';
import { MetricsExplorerChartType } from '../hooks/use_metrics_explorer_options';
import { useKibanaTimeZoneSetting } from '../../../../hooks/use_kibana_time_zone_setting';
import { getMetricId } from './helpers/get_metric_id';

type NumberOrString = string | number;

interface Props {
  metric: MetricsExplorerOptionsMetric;
  id: NumberOrString | NumberOrString[];
  series: MetricsExplorerSeries;
  type: MetricsExplorerChartType;
  stack: boolean;
  opacity?: number;
}

export const MetricExplorerSeriesChart = (props: Props) => {
  if (MetricsExplorerChartType.bar === props.type) {
    return <MetricsExplorerBarChart {...props} />;
  }
  return <MetricsExplorerAreaChart {...props} />;
};

export const MetricsExplorerAreaChart = ({ metric, id, series, type, stack, opacity }: Props) => {
  const timezone = useKibanaTimeZoneSetting();
  const color = (metric.color && colorTransformer(metric.color)) || colorTransformer(Color.color0);

  const yAccessors = Array.isArray(id)
    ? id.map((i) => getMetricId(metric, i)).slice(id.length - 1, id.length)
    : [getMetricId(metric, id)];
  const y0Accessors =
    Array.isArray(id) && id.length > 1
      ? id.map((i) => getMetricId(metric, i)).slice(0, 1)
      : undefined;
  const chartId = `series-${series.id}-${yAccessors.join('-')}`;

  const seriesAreaStyle: RecursivePartial<AreaSeriesStyle> = {
    line: {
      strokeWidth: 2,
      visible: true,
    },
    area: {
      opacity: opacity || 0.5,
      visible: type === MetricsExplorerChartType.area,
    },
  };

  return (
    <AreaSeries
      id={chartId}
      key={chartId}
      name={createMetricLabel(metric)}
      // Defaults to multi layer time axis as of Elastic Charts v70
      xScaleType={ScaleType.Time}
      yScaleType={ScaleType.Linear}
      xAccessor="timestamp"
      yAccessors={yAccessors}
      y0Accessors={y0Accessors}
      data={series.rows}
      stackAccessors={stack ? ['timestamp'] : void 0}
      areaSeriesStyle={seriesAreaStyle}
      color={color}
      timeZone={timezone}
    />
  );
};

export const MetricsExplorerBarChart = ({ metric, id, series, stack }: Props) => {
  const timezone = useKibanaTimeZoneSetting();
  const color = (metric.color && colorTransformer(metric.color)) || colorTransformer(Color.color0);

  const yAccessors = Array.isArray(id)
    ? id.map((i) => getMetricId(metric, i)).slice(id.length - 1, id.length)
    : [getMetricId(metric, id)];
  const chartId = `series-${series.id}-${yAccessors.join('-')}`;

  const seriesBarStyle: RecursivePartial<BarSeriesStyle> = {
    rectBorder: {
      stroke: color,
      strokeWidth: 1,
      visible: true,
    },
    rect: {
      opacity: 1,
    },
  };
  return (
    <BarSeries
      id={chartId}
      key={chartId}
      name={createMetricLabel(metric)}
      // Defaults to multi layer time axis as of Elastic Charts v70
      xScaleType={ScaleType.Time}
      yScaleType={ScaleType.Linear}
      xAccessor="timestamp"
      yAccessors={yAccessors}
      data={series.rows}
      stackAccessors={stack ? ['timestamp'] : void 0}
      barSeriesStyle={seriesBarStyle}
      color={color}
      timeZone={timezone}
    />
  );
};
