/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiHeaderLinks, EuiToolTip, EuiHeaderLink } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { createExploratoryViewUrl } from '@kbn/exploratory-view-plugin/public';
import { useKibana } from '@kbn/kibana-react-plugin/public';

import { stringifyUrlParams } from '../../../lib/helper/url_params/stringify_url_params';
import { useUptimeSettingsContext } from '../../../contexts/uptime_settings_context';
import { useGetUrlParams } from '../../../hooks';
import { ToggleAlertFlyoutButton } from '../../overview/alerts/alerts_containers';
import { MONITOR_ROUTE, SETTINGS_ROUTE } from '../../../../../common/constants';
import { InspectorHeaderLink } from './inspector_header_link';
import { monitorStatusSelector } from '../../../state/selectors';
import { ManageMonitorsBtn } from './manage_monitors_btn';

const ADD_DATA_LABEL = i18n.translate('xpack.uptime.addDataButtonLabel', {
  defaultMessage: 'Add data',
});

const ANALYZE_DATA = i18n.translate('xpack.uptime.analyzeDataButtonLabel', {
  defaultMessage: 'Explore data',
});

const ANALYZE_MESSAGE = i18n.translate('xpack.uptime.analyzeDataButtonLabel.message', {
  defaultMessage:
    'Go to Explore Data, where you can select and filter result data in any dimension and look for the cause or impact of performance problems.',
});

export function ActionMenuContent(): React.ReactElement {
  const kibana = useKibana();

  const { basePath } = useUptimeSettingsContext();
  const params = useGetUrlParams();
  const { dateRangeStart, dateRangeEnd } = params;
  const history = useHistory();

  const selectedMonitor = useSelector(monitorStatusSelector);

  const detailRouteMatch = useRouteMatch(MONITOR_ROUTE);
  const monitorId = selectedMonitor?.monitor?.id;

  const syntheticExploratoryViewLink = createExploratoryViewUrl(
    {
      reportType: 'kpi-over-time',
      allSeries: [
        {
          dataType: 'uptime',
          seriesType: 'area',
          selectedMetricField: 'monitor.duration.us',
          time: { from: dateRangeStart, to: dateRangeEnd },
          breakdown: monitorId ? 'observer.geo.name' : 'monitor.type',
          reportDefinitions: {
            'monitor.name':
              selectedMonitor?.monitor?.name && detailRouteMatch?.isExact === true
                ? [selectedMonitor?.monitor?.name]
                : [],
            'url.full': ['ALL_VALUES'],
          },
          name: monitorId ? `${monitorId}-response-duration` : 'All monitors response duration',
        },
      ],
    },
    basePath
  );

  return (
    <EuiHeaderLinks gutterSize="xs">
      <ManageMonitorsBtn />

      <EuiToolTip position="top" content={<p>{ANALYZE_MESSAGE}</p>}>
        <EuiHeaderLink
          aria-label={i18n.translate('xpack.uptime.page_header.analyzeData.label', {
            defaultMessage: 'Navigate to the "Explore Data" view to visualize Synthetics/User data',
          })}
          href={syntheticExploratoryViewLink}
          color="primary"
          data-test-subj={'uptimeExploreDataButton'}
        >
          {ANALYZE_DATA}
        </EuiHeaderLink>
      </EuiToolTip>

      <ToggleAlertFlyoutButton />

      <EuiHeaderLink
        aria-label={i18n.translate('xpack.uptime.page_header.settingsLink.label', {
          defaultMessage: 'Navigate to the Uptime settings page',
        })}
        color="primary"
        data-test-subj="settings-page-link"
        href={history.createHref({
          pathname: SETTINGS_ROUTE,
          search: stringifyUrlParams(params, true),
        })}
      >
        <FormattedMessage id="xpack.uptime.page_header.settingsLink" defaultMessage="Settings" />
      </EuiHeaderLink>

      <EuiHeaderLink
        aria-label={i18n.translate('xpack.uptime.page_header.addDataLink.label', {
          defaultMessage: 'Navigate to a tutorial about adding Uptime data',
        })}
        href={kibana.services?.application?.getUrlForApp('/home#/tutorial/uptimeMonitors')}
        color="primary"
      >
        {ADD_DATA_LABEL}
      </EuiHeaderLink>
      <InspectorHeaderLink />
    </EuiHeaderLinks>
  );
}
