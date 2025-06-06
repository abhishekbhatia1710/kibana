/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { reducerWithInitialState } from 'typescript-fsa-reducers';

import {
  addNote,
  addNoteToEvent,
  addProvider,
  addTimeline,
  applyKqlFilterQuery,
  clearEventsDeleted,
  clearEventsLoading,
  clearSelected,
  createTimeline,
  dataProviderEdited,
  deleteNoteFromEvent,
  endTimelineSaving,
  initializeSavedSearch,
  initializeTimelineSettings,
  pinEvent,
  removeColumn,
  removeProvider,
  setActiveTabTimeline,
  setChanged,
  setConfirmingNoteId,
  setDataProviderVisibility,
  setEventsDeleted,
  setEventsLoading,
  setExcludedRowRendererIds,
  setFilters,
  setInsertTimeline,
  setSavedQueryId,
  setSelected,
  showCallOutUnauthorizedMsg,
  showTimeline,
  startTimelineSaving,
  toggleModalSaveTimeline,
  unPinEvent,
  updateColumns,
  updateColumnWidth,
  updateDataProviderEnabled,
  updateDataProviderExcluded,
  updateDataProviderType,
  updateDataView,
  updateEqlOptions,
  updateIsFavorite,
  updateItemsPerPage,
  updateItemsPerPageOptions,
  updateKqlMode,
  updateProviders,
  updateRange,
  updateRowHeight,
  updateSampleSize,
  updateSavedSearch,
  updateSavedSearchId,
  updateSort,
  updateTimeline,
  updateTitleAndDescription,
  upsertColumn,
} from './actions';

import {
  addNewTimeline,
  addTimelineNote,
  addTimelineNoteToEvent,
  addTimelineProviders,
  addTimelineToStore,
  applyKqlFilterQueryDraft,
  pinTimelineEvent,
  removeTimelineColumn,
  removeTimelineProvider,
  setDeletedTableEvents,
  setInitializeTimelineSettings,
  setLoadingTableEvents,
  setSelectedTableEvents,
  unPinTimelineEvent,
  updateExcludedRowRenderersIds,
  updateFilters,
  updateSavedQuery,
  updateTimelineColumns,
  updateTimelineColumnWidth,
  updateTimelineIsFavorite,
  updateTimelineItemsPerPage,
  updateTimelineKqlMode,
  updateTimelinePerPageOptions,
  updateTimelineProviderEnabled,
  updateTimelineProviderExcluded,
  updateTimelineProviderProperties,
  updateTimelineProviders,
  updateTimelineProviderType,
  updateTimelineRange,
  updateTimelineShowTimeline,
  updateTimelineSort,
  updateTimelineTitleAndDescription,
  upsertTimelineColumn,
} from './helpers';

import type { TimelineState } from './types';
import { EMPTY_TIMELINE_BY_ID } from './types';
import { TimelineTypeEnum } from '../../../common/api/timeline';

export const initialTimelineState: TimelineState = {
  timelineById: EMPTY_TIMELINE_BY_ID,
  showCallOutUnauthorizedMsg: false,
  insertTimeline: null,
};

/** The reducer for all timeline actions  */
export const timelineReducer = reducerWithInitialState(initialTimelineState)
  .case(addTimeline, (state, { id, timeline, resolveTimelineConfig }) => ({
    ...state,
    timelineById: addTimelineToStore({
      id,
      timeline,
      resolveTimelineConfig,
      timelineById: state.timelineById,
    }),
  }))
  .case(
    createTimeline,
    (state, { id, timelineType = TimelineTypeEnum.default, ...timelineProps }) => {
      return {
        ...state,
        timelineById: addNewTimeline({
          id,
          timelineById: state.timelineById,
          timelineType,
          ...timelineProps,
        }),
      };
    }
  )
  .case(addNote, (state, { id, noteId }) => ({
    ...state,
    timelineById: addTimelineNote({ id, noteId, timelineById: state.timelineById }),
  }))
  .case(addNoteToEvent, (state, { id, noteId, eventId }) => ({
    ...state,
    timelineById: addTimelineNoteToEvent({ id, noteId, eventId, timelineById: state.timelineById }),
  }))
  .case(addProvider, (state, { id, providers }) => ({
    ...state,
    timelineById: addTimelineProviders({ id, providers, timelineById: state.timelineById }),
  }))
  .case(applyKqlFilterQuery, (state, { id, filterQuery }) => ({
    ...state,
    timelineById: applyKqlFilterQueryDraft({
      id,
      filterQuery,
      timelineById: state.timelineById,
    }),
  }))
  .case(showTimeline, (state, { id, show }) => ({
    ...state,
    timelineById: updateTimelineShowTimeline({ id, show, timelineById: state.timelineById }),
  }))
  .case(pinEvent, (state, { id, eventId }) => ({
    ...state,
    timelineById: pinTimelineEvent({ id, eventId, timelineById: state.timelineById }),
  }))
  .case(removeProvider, (state, { id, providerId, andProviderId }) => ({
    ...state,
    timelineById: removeTimelineProvider({
      id,
      providerId,
      timelineById: state.timelineById,
      andProviderId,
    }),
  }))
  .case(startTimelineSaving, (state, { id }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        isSaving: true,
      },
    },
  }))
  .case(endTimelineSaving, (state, { id }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        isSaving: false,
      },
    },
  }))
  .case(setExcludedRowRendererIds, (state, { id, excludedRowRendererIds }) => ({
    ...state,
    timelineById: updateExcludedRowRenderersIds({
      id,
      excludedRowRendererIds,
      timelineById: state.timelineById,
    }),
  }))
  .case(updateTimeline, (state, { id, timeline }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: timeline,
    },
  }))
  .case(unPinEvent, (state, { id, eventId }) => ({
    ...state,
    timelineById: unPinTimelineEvent({ id, eventId, timelineById: state.timelineById }),
  }))
  .case(updateIsFavorite, (state, { id, isFavorite }) => ({
    ...state,
    timelineById: updateTimelineIsFavorite({ id, isFavorite, timelineById: state.timelineById }),
  }))
  .case(updateKqlMode, (state, { id, kqlMode }) => ({
    ...state,
    timelineById: updateTimelineKqlMode({ id, kqlMode, timelineById: state.timelineById }),
  }))
  .case(updateTitleAndDescription, (state, { id, title, description }) => ({
    ...state,
    timelineById: updateTimelineTitleAndDescription({
      id,
      title,
      description,
      timelineById: state.timelineById,
    }),
  }))
  .case(updateProviders, (state, { id, providers }) => ({
    ...state,
    timelineById: updateTimelineProviders({ id, providers, timelineById: state.timelineById }),
  }))
  .case(updateRange, (state, { id, start, end }) => ({
    ...state,
    timelineById: updateTimelineRange({ id, start, end, timelineById: state.timelineById }),
  }))
  .case(updateDataProviderEnabled, (state, { id, enabled, providerId, andProviderId }) => ({
    ...state,
    timelineById: updateTimelineProviderEnabled({
      id,
      enabled,
      providerId,
      timelineById: state.timelineById,
      andProviderId,
    }),
  }))
  .case(updateDataProviderExcluded, (state, { id, excluded, providerId, andProviderId }) => ({
    ...state,
    timelineById: updateTimelineProviderExcluded({
      id,
      excluded,
      providerId,
      timelineById: state.timelineById,
      andProviderId,
    }),
  }))

  .case(
    dataProviderEdited,
    (state, { andProviderId, excluded, field, id, operator, providerId, value }) => ({
      ...state,
      timelineById: updateTimelineProviderProperties({
        andProviderId,
        excluded,
        field,
        id,
        operator,
        providerId,
        timelineById: state.timelineById,
        value,
      }),
    })
  )
  .case(updateDataProviderType, (state, { id, type, providerId, andProviderId }) => ({
    ...state,
    timelineById: updateTimelineProviderType({
      id,
      type,
      providerId,
      timelineById: state.timelineById,
      andProviderId,
    }),
  }))
  .case(showCallOutUnauthorizedMsg, (state) => ({
    ...state,
    showCallOutUnauthorizedMsg: true,
  }))
  .case(setSavedQueryId, (state, { id, savedQueryId }) => ({
    ...state,
    timelineById: updateSavedQuery({
      id,
      savedQueryId,
      timelineById: state.timelineById,
    }),
  }))
  .case(setFilters, (state, { id, filters }) => ({
    ...state,
    timelineById: updateFilters({
      id,
      filters,
      timelineById: state.timelineById,
    }),
  }))
  .case(setInsertTimeline, (state, insertTimeline) => ({
    ...state,
    insertTimeline,
  }))
  .case(updateDataView, (state, { id, dataViewId, indexNames }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        dataViewId,
        indexNames,
      },
    },
  }))
  .case(setActiveTabTimeline, (state, { id, activeTab, scrollToTop }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        activeTab,
        prevActiveTab: state.timelineById[id].activeTab,
        scrollToTop: scrollToTop
          ? {
              timestamp: Math.floor(Date.now() / 1000), // convert to seconds to avoid unnecessary rerenders for multiple clicks
            }
          : undefined,
      },
    },
  }))
  .case(toggleModalSaveTimeline, (state, { id, showModalSaveTimeline }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        showSaveModal: showModalSaveTimeline,
      },
    },
  }))
  .case(updateEqlOptions, (state, { id, field, value }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        eqlOptions: {
          ...(state.timelineById[id].eqlOptions ?? {}),
          [field]: value,
        },
      },
    },
  }))
  .case(setEventsLoading, (state, { id, eventIds, isLoading }) => ({
    ...state,
    timelineById: setLoadingTableEvents({
      id,
      eventIds,
      timelineById: state.timelineById,
      isLoading,
    }),
  }))
  .case(removeColumn, (state, { id, columnId }) => ({
    ...state,
    timelineById: removeTimelineColumn({
      id,
      columnId,
      timelineById: state.timelineById,
    }),
  }))
  .case(upsertColumn, (state, { column, id, index }) => ({
    ...state,
    timelineById: upsertTimelineColumn({ column, id, index, timelineById: state.timelineById }),
  }))
  .case(updateColumns, (state, { id, columns }) => ({
    ...state,
    timelineById: updateTimelineColumns({
      id,
      columns,
      timelineById: state.timelineById,
    }),
  }))
  .case(updateSort, (state, { id, sort }) => ({
    ...state,
    timelineById: updateTimelineSort({ id, sort, timelineById: state.timelineById }),
  }))
  .case(setSelected, (state, { id, eventIds, isSelected, isSelectAllChecked }) => ({
    ...state,
    timelineById: setSelectedTableEvents({
      id,
      eventIds,
      timelineById: state.timelineById,
      isSelected,
      isSelectAllChecked,
    }),
  }))
  .case(clearSelected, (state, { id }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        selectedEventIds: {},
        isSelectAllChecked: false,
      },
    },
  }))
  .case(setEventsDeleted, (state, { id, eventIds, isDeleted }) => ({
    ...state,
    timelineById: setDeletedTableEvents({
      id,
      eventIds,
      timelineById: state.timelineById,
      isDeleted,
    }),
  }))
  .case(initializeTimelineSettings, (state, { id, ...timelineSettingsProps }) => ({
    ...state,
    timelineById: setInitializeTimelineSettings({
      id,
      timelineById: state.timelineById,
      timelineSettingsProps,
    }),
  }))
  .case(updateItemsPerPage, (state, { id, itemsPerPage }) => ({
    ...state,
    timelineById: updateTimelineItemsPerPage({
      id,
      itemsPerPage,
      timelineById: state.timelineById,
    }),
  }))
  .case(updateItemsPerPageOptions, (state, { id, itemsPerPageOptions }) => ({
    ...state,
    timelineById: updateTimelinePerPageOptions({
      id,
      itemsPerPageOptions,
      timelineById: state.timelineById,
    }),
  }))
  .case(clearEventsDeleted, (state, { id }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        deletedEventIds: [],
      },
    },
  }))
  .case(clearEventsLoading, (state, { id }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        loadingEventIds: [],
      },
    },
  }))
  .case(updateSavedSearchId, (state, { id, savedSearchId }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        savedSearchId,
      },
    },
  }))
  .case(initializeSavedSearch, (state, { id, savedSearch }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        savedSearch,
      },
    },
  }))
  .case(updateSavedSearch, (state, { id, savedSearch }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        savedSearch,
      },
    },
  }))
  .case(setDataProviderVisibility, (state, { id, isDataProviderVisible }) => {
    return {
      ...state,
      timelineById: {
        ...state.timelineById,
        [id]: {
          ...state.timelineById[id],
          isDataProviderVisible,
        },
      },
    };
  })
  .case(setChanged, (state, { id, changed }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        changed,
      },
    },
  }))
  .case(updateColumnWidth, (state, { id, columnId, width }) => ({
    ...state,
    timelineById: updateTimelineColumnWidth({
      columnId,
      id,
      timelineById: state.timelineById,
      width,
    }),
  }))

  .case(updateSampleSize, (state, { id, sampleSize }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        sampleSize,
      },
    },
  }))

  .case(updateRowHeight, (state, { id, rowHeight }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        rowHeight,
      },
    },
  }))
  .case(setConfirmingNoteId, (state, { id, confirmingNoteId }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        confirmingNoteId,
      },
    },
  }))
  .case(deleteNoteFromEvent, (state, { id, noteId, eventId }) => ({
    ...state,
    timelineById: {
      ...state.timelineById,
      [id]: {
        ...state.timelineById[id],
        eventIdToNoteIds: {
          ...state.timelineById[id].eventIdToNoteIds,
          [eventId]: state.timelineById[id].eventIdToNoteIds[eventId].filter(
            (note) => note !== noteId
          ),
        },
      },
    },
  }))
  .build();
