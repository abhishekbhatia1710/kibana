/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { memo, useCallback } from 'react';
import { EuiLink, EuiToolTip } from '@elastic/eui';

import { useUpsellingMessage } from '../../../../hooks/use_upselling';
import { useTimelineClick } from '../../../../utils/timeline/use_timeline_click';
import type { TimelineProps } from './types';
import * as i18n from './translations';
import { useAppToasts } from '../../../../hooks/use_app_toasts';
import { useUserPrivileges } from '../../../user_privileges';

export const TimelineMarkDownRendererComponent: React.FC<TimelineProps> = ({ id, title }) => {
  const { addError } = useAppToasts();

  const interactionsUpsellingMessage = useUpsellingMessage('investigation_guide_interactions');
  const {
    timelinePrivileges: { read: canReadTimelines },
  } = useUserPrivileges();
  const isDisabled = !!interactionsUpsellingMessage || !canReadTimelines;

  const handleTimelineClick = useTimelineClick();

  const onError = useCallback(
    (error: Error, timelineId: string) => {
      addError(error, {
        title: i18n.TIMELINE_ERROR_TITLE,
        toastMessage: i18n.FAILED_TO_RETRIEVE_TIMELINE(timelineId),
      });
    },
    [addError]
  );

  const onClickTimeline = useCallback(
    () => handleTimelineClick(id ?? '', onError),
    [id, handleTimelineClick, onError]
  );
  return (
    <EuiToolTip content={interactionsUpsellingMessage ?? i18n.TIMELINE_ID(id ?? '')}>
      <EuiLink
        onClick={onClickTimeline}
        disabled={isDisabled}
        data-test-subj={`markdown-timeline-link-${id}`}
      >
        {title}
      </EuiLink>
    </EuiToolTip>
  );
};

export const TimelineMarkDownRenderer = memo(TimelineMarkDownRendererComponent);
