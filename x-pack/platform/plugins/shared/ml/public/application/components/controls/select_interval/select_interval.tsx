/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FC } from 'react';
import React from 'react';
import { EuiIcon, EuiSelect, EuiToolTip } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { usePageUrlState, type UrlStateService } from '@kbn/ml-url-state';

interface TableIntervalPageUrlState {
  pageKey: 'mlSelectInterval';
  pageUrlState: TableInterval;
}

export interface TableInterval {
  display: string;
  val: string;
}

const OPTIONS = [
  {
    value: 'auto',
    text: i18n.translate('xpack.ml.controls.selectInterval.autoLabel', { defaultMessage: 'Auto' }),
  },
  {
    value: 'hour',
    text: i18n.translate('xpack.ml.controls.selectInterval.hourLabel', {
      defaultMessage: '1 hour',
    }),
  },
  {
    value: 'day',
    text: i18n.translate('xpack.ml.controls.selectInterval.dayLabel', { defaultMessage: '1 day' }),
  },
  {
    value: 'second',
    text: i18n.translate('xpack.ml.controls.selectInterval.showAllLabel', {
      defaultMessage: 'Show all',
    }),
  },
];

function optionValueToInterval(value: string) {
  // Builds the corresponding interval object with the required display and val properties
  // from the specified value.
  const option = OPTIONS.find((opt) => opt.value === value);

  // Default to auto if supplied value doesn't map to one of the options.
  let interval: TableInterval = { display: OPTIONS[0].text, val: OPTIONS[0].value };
  if (option !== undefined) {
    interval = { display: option.text, val: option.value };
  }

  return interval;
}

export const TABLE_INTERVAL_DEFAULT = optionValueToInterval('auto');

export const useTableInterval = (): [
  TableInterval,
  (v: TableInterval) => void,
  UrlStateService<TableInterval>
] => {
  const [interval, updateCallback, tableIntervalUrlStateService] =
    usePageUrlState<TableIntervalPageUrlState>('mlSelectInterval', TABLE_INTERVAL_DEFAULT);
  return [interval, updateCallback, tableIntervalUrlStateService];
};

/*
 * React component for rendering a select element with various aggregation interval levels.
 */
export const SelectInterval: FC = () => {
  const [interval, setInterval] = useTableInterval();

  return <SelectIntervalUI interval={interval} onChange={setInterval} />;
};

interface SelectIntervalUIProps {
  interval: TableInterval;
  onChange: (interval: TableInterval) => void;
}
export const SelectIntervalUI: FC<SelectIntervalUIProps> = ({ interval, onChange }) => {
  const handleOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(optionValueToInterval(e.target.value));
  };

  return (
    <EuiSelect
      data-test-subj="mlAnomalyIntervalControls"
      prepend={i18n.translate('xpack.ml.controls.selectInterval.intervalLabel', {
        defaultMessage: 'Interval',
      })}
      append={
        <EuiToolTip
          content={i18n.translate('xpack.ml.controls.selectInterval.intervalTooltip', {
            defaultMessage:
              'Show only the highest severity anomaly for each interval (such as hour or day) or show all anomalies in the selected time period.',
          })}
        >
          <EuiIcon type="question" color="subdued" />
        </EuiToolTip>
      }
      compressed
      options={OPTIONS}
      value={interval.val}
      onChange={handleOnChange}
      aria-label={i18n.translate('xpack.ml.controls.selectInterval.ariaLabel', {
        defaultMessage: 'Select interval',
      })}
    />
  );
};
