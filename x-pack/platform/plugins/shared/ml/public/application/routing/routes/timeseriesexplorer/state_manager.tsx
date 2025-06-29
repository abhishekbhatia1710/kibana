/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { isEqual } from 'lodash';
import type { FC } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import usePrevious from 'react-use/lib/usePrevious';
import moment from 'moment';
import { useUrlState } from '@kbn/ml-url-state';
import { useTimefilter } from '@kbn/ml-date-picker';
import type { IUiSettingsClient } from '@kbn/core/public';
import type { TimeRangeBounds } from '@kbn/ml-time-buckets';
import { getViewableDetectors } from '../../../timeseriesexplorer/timeseriesexplorer_utils/get_viewable_detectors';
import { useNotifications } from '../../../contexts/kibana';
import type { MlJobWithTimeRange } from '../../../../../common/types/anomaly_detection_jobs';
import { isTimeSeriesViewJob } from '../../../../../common/util/job_utils';
import { TimeSeriesExplorer } from '../../../timeseriesexplorer';
import { useMlJobService } from '../../../services/job_service';
import { useForecastService } from '../../../services/forecast_service';
import { useTimeSeriesExplorerService } from '../../../util/time_series_explorer_service';
import { APP_STATE_ACTION } from '../../../timeseriesexplorer/timeseriesexplorer_constants';
import { validateJobSelection } from '../../../timeseriesexplorer/timeseriesexplorer_utils';
import { TimeSeriesExplorerPage } from '../../../timeseriesexplorer/timeseriesexplorer_page';
import { TimeseriesexplorerNoJobsFound } from '../../../timeseriesexplorer/components/timeseriesexplorer_no_jobs_found';
import { useTableInterval } from '../../../components/controls/select_interval';
import { useTableSeverity } from '../../../components/controls/select_severity';
import { useTimeSeriesExplorerUrlState } from '../../../timeseriesexplorer/hooks/use_timeseriesexplorer_url_state';
import type { TimeSeriesExplorerAppState } from '../../../../../common/types/locator';
import { useJobSelectionFlyout } from '../../../contexts/ml/use_job_selection_flyout';
import { useRefresh } from '../../use_refresh';
import { TimeseriesexplorerNoChartData } from '../../../timeseriesexplorer/components/timeseriesexplorer_no_chart_data';

type AppStateZoom = Exclude<TimeSeriesExplorerAppState['mlTimeSeriesExplorer'], undefined>['zoom'];

export interface TimeSeriesExplorerUrlStateManager {
  config: IUiSettingsClient;
  jobsWithTimeRange: MlJobWithTimeRange[];
}

export const TimeSeriesExplorerUrlStateManager: FC<TimeSeriesExplorerUrlStateManager> = ({
  config,
  jobsWithTimeRange,
}) => {
  const mlJobService = useMlJobService();
  const { toasts } = useNotifications();
  const mlForecastService = useForecastService();
  const [timeSeriesExplorerUrlState, setTimeSeriesExplorerUrlState] =
    useTimeSeriesExplorerUrlState();
  const [globalState, setGlobalState] = useUrlState('_g');
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const timefilter = useTimefilter({ timeRangeSelector: true, autoRefreshSelector: true });
  const [invalidTimeRangeError, setInValidTimeRangeError] = useState<boolean>(false);

  const refresh = useRefresh();
  const previousRefresh = usePrevious(refresh?.lastRefresh ?? 0);
  const timeSeriesExplorerService = useTimeSeriesExplorerService();

  // We cannot simply infer bounds from the globalState's `time` attribute
  // with `moment` since it can contain custom strings such as `now-15m`.
  // So when globalState's `time` changes, we update the timefilter and use
  // `timefilter.getBounds()` to update `bounds` in this component's state.
  const [bounds, setBounds] = useState<TimeRangeBounds | undefined>(undefined);
  useEffect(() => {
    if (globalState?.time !== undefined) {
      if (globalState.time.mode === 'invalid') {
        setInValidTimeRangeError(true);
      }

      const timefilterBounds = timefilter.getBounds();
      // Only if both min/max bounds are valid moment times set the bounds.
      // An invalid string restored from globalState might return `undefined`.
      if (timefilterBounds?.min !== undefined && timefilterBounds?.max !== undefined) {
        setBounds(timefilter.getBounds());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalState?.time?.from, globalState?.time?.to, globalState?.time?.ts]);

  const selectedJobIds = globalState?.ml?.jobIds;

  // Sort selectedJobIds so we can be sure comparison works when stringifying.
  if (Array.isArray(selectedJobIds)) {
    selectedJobIds.sort();
  }

  // When changing jobs we'll clear appState (detectorIndex, entities, forecastId).
  // To restore settings from the URL on initial load we also need to check against
  // `previousSelectedJobIds` to avoid wiping appState.
  const previousSelectedJobIds = usePrevious(selectedJobIds);
  const isJobChange = !isEqual(previousSelectedJobIds, selectedJobIds);

  const selectedEntities = isJobChange
    ? undefined
    : timeSeriesExplorerUrlState?.mlTimeSeriesExplorer?.entities;
  const selectedForecastId = isJobChange
    ? undefined
    : timeSeriesExplorerUrlState?.mlTimeSeriesExplorer?.forecastId;
  const selectedFunctionDescription = isJobChange
    ? undefined
    : timeSeriesExplorerUrlState?.mlTimeSeriesExplorer?.functionDescription;
  const zoom: AppStateZoom | undefined = isJobChange
    ? undefined
    : timeSeriesExplorerUrlState?.mlTimeSeriesExplorer?.zoom;

  const selectedJob = selectedJobId !== undefined ? mlJobService.getJob(selectedJobId) : undefined;
  const timeSeriesJobs = mlJobService.jobs.filter(isTimeSeriesViewJob);

  const viewableDetector = selectedJob ? getViewableDetectors(selectedJob)[0]?.index ?? 0 : 0;

  // Next we get globalState and appState information to pass it on as props later.
  // If a job change is going on, we fall back to defaults (as if appState was already cleared),
  // otherwise the page could break.
  const selectedDetectorIndex = isJobChange
    ? viewableDetector
    : timeSeriesExplorerUrlState?.mlTimeSeriesExplorer?.detectorIndex ?? viewableDetector;

  let autoZoomDuration: number | undefined;
  if (selectedJobId !== undefined && selectedJob !== undefined) {
    autoZoomDuration = timeSeriesExplorerService.getAutoZoomDuration(
      selectedJob.analysis_config.bucket_span
    );
  }

  const appStateHandler = useCallback(
    (action: string, payload?: any) => {
      /**
       * Empty zoom indicates that chart hasn't been rendered yet,
       * hence any updates prior that should replace the URL state.
       */
      const isInitUpdate = timeSeriesExplorerUrlState?.mlTimeSeriesExplorer?.zoom === undefined;

      const mlTimeSeriesExplorer: TimeSeriesExplorerAppState['mlTimeSeriesExplorer'] =
        timeSeriesExplorerUrlState?.mlTimeSeriesExplorer !== undefined
          ? { ...timeSeriesExplorerUrlState.mlTimeSeriesExplorer }
          : {};

      switch (action) {
        case APP_STATE_ACTION.CLEAR:
          delete mlTimeSeriesExplorer.detectorIndex;
          delete mlTimeSeriesExplorer.entities;
          delete mlTimeSeriesExplorer.forecastId;
          delete mlTimeSeriesExplorer.zoom;
          delete mlTimeSeriesExplorer.functionDescription;
          break;

        case APP_STATE_ACTION.SET_DETECTOR_INDEX:
          mlTimeSeriesExplorer.detectorIndex = payload;
          delete mlTimeSeriesExplorer.functionDescription;

          break;

        case APP_STATE_ACTION.SET_ENTITIES:
          mlTimeSeriesExplorer.entities = payload;
          delete mlTimeSeriesExplorer.functionDescription;

          break;

        case APP_STATE_ACTION.SET_FORECAST_ID:
          mlTimeSeriesExplorer.forecastId = payload;
          delete mlTimeSeriesExplorer.zoom;
          break;

        case APP_STATE_ACTION.SET_ZOOM:
          mlTimeSeriesExplorer.zoom = payload;
          break;

        case APP_STATE_ACTION.UNSET_ZOOM:
          delete mlTimeSeriesExplorer.zoom;
          break;

        case APP_STATE_ACTION.SET_FUNCTION_DESCRIPTION:
          mlTimeSeriesExplorer.functionDescription = payload;
          break;
      }

      setTimeSeriesExplorerUrlState({ mlTimeSeriesExplorer }, isInitUpdate);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(timeSeriesExplorerUrlState?.mlTimeSeriesExplorer),
      setTimeSeriesExplorerUrlState,
    ]
  );

  const getJobSelection = useJobSelectionFlyout();

  const handleJobSelectionChange = useCallback(
    ({
      jobIds,
      time,
    }: {
      jobIds: string[];

      time?: { from: string; to: string };
    }) => {
      setGlobalState({
        ml: {
          jobIds,
        },
        ...(time !== undefined ? { time } : {}),
      });
    },
    [setGlobalState]
  );

  // Use a side effect to clear appState when changing jobs.
  useEffect(() => {
    if (selectedJobIds !== undefined && previousSelectedJobIds !== undefined) {
      appStateHandler(APP_STATE_ACTION.CLEAR);
    }
    const validatedJobId = validateJobSelection(
      jobsWithTimeRange,
      selectedJobIds,
      setGlobalState,
      mlJobService,
      toasts,
      getJobSelection
    );
    if (typeof validatedJobId === 'string') {
      setSelectedJobId(validatedJobId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selectedJobIds)]);

  const boundsMinMs = bounds?.min?.valueOf();
  const boundsMaxMs = bounds?.max?.valueOf();

  const [selectedForecastIdProp, setSelectedForecastIdProp] = useState<string | undefined>(
    timeSeriesExplorerUrlState?.mlTimeSeriesExplorer?.forecastId
  );

  useEffect(() => {
    if (selectedForecastIdProp !== selectedForecastId) {
      setSelectedForecastIdProp(undefined);
    }

    if (
      autoZoomDuration !== undefined &&
      boundsMinMs !== undefined &&
      boundsMaxMs !== undefined &&
      selectedJob !== undefined &&
      selectedForecastId !== undefined
    ) {
      mlForecastService
        .getForecastDateRange(selectedJob, selectedForecastId)
        .then((resp) => {
          if (autoZoomDuration === undefined) {
            return;
          }

          const earliest = moment(resp.earliest || boundsMinMs);
          const latest = moment(resp.latest || boundsMaxMs);

          if (earliest.isBefore(moment(boundsMinMs)) || latest.isAfter(moment(boundsMaxMs))) {
            const earliestMs = Math.min(earliest.valueOf(), boundsMinMs);
            const latestMs = Math.max(latest.valueOf(), boundsMaxMs);

            // FIXME we should not update global state here
            setGlobalState('time', {
              from: moment(earliestMs).toISOString(),
              to: moment(latestMs).toISOString(),
            });
          }
          setSelectedForecastIdProp(selectedForecastId);
        })
        .catch((resp) => {
          // eslint-disable-next-line no-console
          console.error(
            'Time series explorer - error loading time range of forecast from elasticsearch:',
            resp
          );
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedForecastId]);

  const [tableInterval] = useTableInterval();
  const [tableSeverity] = useTableSeverity();

  const tzConfig = config.get('dateFormat:tz');
  const dateFormatTz = tzConfig !== 'Browser' ? tzConfig : moment.tz.guess();

  if (timeSeriesJobs.length === 0 || selectedJobId === undefined) {
    return (
      <TimeSeriesExplorerPage
        dateFormatTz={dateFormatTz}
        noSingleMetricJobsFound
        handleJobSelectionChange={handleJobSelectionChange}
      >
        <TimeseriesexplorerNoJobsFound />
      </TimeSeriesExplorerPage>
    );
  }

  if (!bounds) {
    return (
      <TimeSeriesExplorerPage
        dateFormatTz={dateFormatTz}
        handleJobSelectionChange={handleJobSelectionChange}
        selectedJobId={[selectedJobId]}
      >
        <TimeseriesexplorerNoChartData />
      </TimeSeriesExplorerPage>
    );
  }

  const zoomProp: AppStateZoom | undefined =
    typeof selectedForecastId === 'string' && selectedForecastIdProp === undefined
      ? undefined
      : zoom;

  return (
    <TimeSeriesExplorer
      {...{
        appStateHandler,
        autoZoomDuration,
        bounds,
        dateFormatTz,
        lastRefresh: refresh?.lastRefresh ?? 0,
        previousRefresh,
        selectedJobId,
        selectedDetectorIndex,
        selectedEntities,
        selectedForecastId: selectedForecastIdProp,
        tableInterval: tableInterval.val,
        tableSeverity,
        timefilter,
        zoom: zoomProp,
        invalidTimeRangeError,
        functionDescription: selectedFunctionDescription,
        handleJobSelectionChange,
      }}
    />
  );
};
