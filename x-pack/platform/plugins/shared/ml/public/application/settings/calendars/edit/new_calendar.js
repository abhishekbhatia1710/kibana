/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { Component, Fragment } from 'react';
import { PropTypes } from 'prop-types';

import { i18n } from '@kbn/i18n';

import { EuiPageBody } from '@elastic/eui';

import { getCalendarSettingsData, validateCalendarId } from './utils';
import { CalendarForm } from './calendar_form';
import { NewEventModal } from './new_event_modal';
import { ImportModal } from './import_modal';
import { withKibana } from '@kbn/kibana-react-plugin/public';
import { GLOBAL_CALENDAR } from '../../../../../common/constants/calendars';
import { ML_PAGES } from '../../../../../common/constants/locator';
import { toastNotificationServiceProvider } from '../../../services/toast_notification_service';
import { HelpMenu } from '../../../components/help_menu';

class NewCalendarUI extends Component {
  static propTypes = {
    calendarId: PropTypes.string,
    isDst: PropTypes.bool.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      isNewEventModalVisible: false,
      isImportModalVisible: false,
      isNewCalendarIdValid: null,
      loading: true,
      jobIds: [],
      jobIdOptions: [],
      groupIds: [],
      groupIdOptions: [],
      calendars: [],
      formCalendarId: '',
      description: '',
      selectedJobOptions: [],
      selectedGroupOptions: [],
      events: [],
      saving: false,
      selectedCalendar: undefined,
      isGlobalCalendar: false,
    };
  }

  componentDidMount() {
    this.toastNotificationService = toastNotificationServiceProvider(
      this.props.kibana.services.notifications.toasts
    );
    this.formSetup();
  }

  returnToCalendarsManagementPage = async () => {
    const {
      services: {
        http: { basePath },
        application: { navigateToUrl },
      },
    } = this.props.kibana;
    await navigateToUrl(
      `${basePath.get()}/app/management/ml/ad_settings/${
        this.props.isDst ? ML_PAGES.CALENDARS_DST_MANAGE : ML_PAGES.CALENDARS_MANAGE
      }`,
      true
    );
  };

  async formSetup() {
    try {
      const { jobIds, groupIds, calendars } = await getCalendarSettingsData(
        this.props.kibana.services.mlServices.mlApi
      );

      const jobIdOptions = jobIds.map((jobId) => ({ label: jobId }));
      const groupIdOptions = groupIds.map((groupId) => ({ label: groupId }));

      const selectedJobOptions = [];
      const selectedGroupOptions = [];
      let eventsList = [];
      let selectedCalendar;
      let formCalendarId = '';
      let isGlobalCalendar = false;

      // Editing existing calendar.
      if (this.props.calendarId !== undefined) {
        selectedCalendar = calendars.find((cal) => cal.calendar_id === this.props.calendarId);

        if (selectedCalendar) {
          formCalendarId = selectedCalendar.calendar_id;
          eventsList = selectedCalendar.events;

          if (selectedCalendar.job_ids.includes(GLOBAL_CALENDAR)) {
            isGlobalCalendar = true;
          } else {
            selectedCalendar.job_ids.forEach((id) => {
              if (jobIds.find((jobId) => jobId === id)) {
                selectedJobOptions.push({ label: id });
              } else if (groupIds.find((groupId) => groupId === id)) {
                selectedGroupOptions.push({ label: id });
              }
            });
          }
        }
      }

      this.setState({
        events: eventsList,
        formCalendarId,
        jobIds,
        jobIdOptions,
        groupIds,
        groupIdOptions,
        calendars,
        loading: false,
        selectedJobOptions,
        selectedGroupOptions,
        selectedCalendar,
        isGlobalCalendar,
      });
    } catch (error) {
      this.setState({ loading: false });
      this.toastNotificationService.displayErrorToast(
        error,
        i18n.translate('xpack.ml.calendarsEdit.errorWithLoadingCalendarFromDataErrorMessage', {
          defaultMessage: 'An error occurred loading calendar form data. Try refreshing the page.',
        })
      );
    }
  }

  isDuplicateId = () => {
    const { calendars, formCalendarId } = this.state;

    for (let i = 0; i < calendars.length; i++) {
      if (calendars[i].calendar_id === formCalendarId) {
        return true;
      }
    }

    return false;
  };

  onCreate = async () => {
    const mlApi = this.props.kibana.services.mlServices.mlApi;
    const { formCalendarId } = this.state;

    if (this.isDuplicateId()) {
      const { toasts } = this.props.kibana.services.notifications;
      toasts.addDanger(
        i18n.translate('xpack.ml.calendarsEdit.canNotCreateCalendarWithExistingIdErrorMessag', {
          defaultMessage: 'Cannot create calendar with id [{formCalendarId}] as it already exists.',
          values: { formCalendarId },
        })
      );
    } else {
      const calendar = this.setUpCalendarForApi();
      this.setState({ saving: true });

      try {
        await mlApi.addCalendar(calendar);
        await this.returnToCalendarsManagementPage();
      } catch (error) {
        this.setState({ saving: false });
        this.toastNotificationService.displayErrorToast(
          error,
          i18n.translate('xpack.ml.calendarsEdit.errorWithCreatingCalendarErrorMessage', {
            defaultMessage: 'An error occurred creating calendar {calendarId}',
            values: { calendarId: calendar.calendarId },
          })
        );
      }
    }
  };

  onEdit = async () => {
    const mlApi = this.props.kibana.services.mlServices.mlApi;
    const calendar = this.setUpCalendarForApi();
    this.setState({ saving: true });

    try {
      await mlApi.updateCalendar(calendar);
      await this.returnToCalendarsManagementPage();
    } catch (error) {
      this.setState({ saving: false });
      this.toastNotificationService.displayErrorToast(
        error,
        i18n.translate('xpack.ml.calendarsEdit.errorWithUpdatingCalendarErrorMessage', {
          defaultMessage:
            'An error occurred saving calendar {calendarId}. Try refreshing the page.',
          values: { calendarId: calendar.calendarId },
        })
      );
    }
  };

  setUpCalendarForApi = () => {
    const {
      formCalendarId,
      description,
      events,
      selectedGroupOptions,
      selectedJobOptions,
      isGlobalCalendar,
    } = this.state;

    const allIds = isGlobalCalendar
      ? [GLOBAL_CALENDAR]
      : [
          ...selectedJobOptions.map((option) => option.label),
          ...selectedGroupOptions.map((option) => option.label),
        ];

    // Reduce events to fields expected by api
    const eventsToSave = events.map((event) => ({
      description: event.description,
      start_time: event.start_time,
      end_time: event.end_time,
      ...(event.skip_result !== undefined ? { skip_result: event.skip_result } : {}),
      ...(event.skip_model_update !== undefined
        ? { skip_model_update: event.skip_model_update }
        : {}),
      ...(event.force_time_shift !== undefined ? { force_time_shift: event.force_time_shift } : {}),
    }));

    // set up calendar
    const calendar = {
      calendarId: formCalendarId,
      description,
      events: eventsToSave,
      job_ids: allIds,
    };

    return calendar;
  };

  onCreateGroupOption = (newGroup) => {
    const newOption = {
      label: newGroup,
    };
    // Select the option.
    this.setState((prevState) => ({
      selectedGroupOptions: prevState.selectedGroupOptions.concat(newOption),
    }));
  };

  onGlobalCalendarChange = ({ currentTarget }) => {
    this.setState({
      isGlobalCalendar: currentTarget.checked,
    });
  };

  onJobSelection = (selectedJobOptions) => {
    this.setState({
      selectedJobOptions,
    });
  };

  onGroupSelection = (selectedGroupOptions) => {
    this.setState({
      selectedGroupOptions,
    });
  };

  onCalendarIdChange = (e) => {
    const isValid = validateCalendarId(e.target.value);

    this.setState({
      formCalendarId: e.target.value,
      isNewCalendarIdValid: isValid,
    });
  };

  onDescriptionChange = (e) => {
    this.setState({
      description: e.target.value,
    });
  };

  showImportModal = () => {
    this.setState((prevState) => ({
      isImportModalVisible: !prevState.isImportModalVisible,
    }));
  };

  closeImportModal = () => {
    this.setState({
      isImportModalVisible: false,
    });
  };

  onEventDelete = (eventId) => {
    this.setState((prevState) => ({
      events: prevState.events.filter((event) => event.event_id !== eventId),
    }));
  };

  closeNewEventModal = () => {
    this.setState({ isNewEventModalVisible: false });
  };

  showNewEventModal = () => {
    this.setState({ isNewEventModalVisible: true });
  };

  addEvent = (event) => {
    this.setState((prevState) => ({
      events: [...prevState.events, event],
      isNewEventModalVisible: false,
    }));
  };

  addEvents = (events) => {
    this.setState((prevState) => ({
      events: [...prevState.events, ...events],
      isNewEventModalVisible: false,
    }));
  };

  clearEvents = () => {
    this.setState(() => ({
      events: [],
    }));
  };

  addImportedEvents = (events) => {
    this.setState((prevState) => ({
      events: [...prevState.events, ...events],
      isImportModalVisible: false,
    }));
  };

  render() {
    const {
      events,
      isNewEventModalVisible,
      isImportModalVisible,
      isNewCalendarIdValid,
      formCalendarId,
      description,
      groupIdOptions,
      jobIdOptions,
      saving,
      loading,
      selectedCalendar,
      selectedJobOptions,
      selectedGroupOptions,
      isGlobalCalendar,
    } = this.state;

    const helpLink = this.props.kibana.services.docLinks.links.ml.calendars;

    let modal = '';

    if (isNewEventModalVisible) {
      modal = <NewEventModal addEvent={this.addEvent} closeModal={this.closeNewEventModal} />;
    } else if (isImportModalVisible) {
      modal = (
        <ImportModal
          addImportedEvents={this.addImportedEvents}
          closeImportModal={this.closeImportModal}
        />
      );
    }

    return (
      <Fragment>
        <div data-test-subj="mlPageCalendarEdit">
          <EuiPageBody>
            <CalendarForm
              calendarId={selectedCalendar ? selectedCalendar.calendar_id : formCalendarId}
              description={selectedCalendar ? selectedCalendar.description : description}
              eventsList={events}
              groupIdOptions={groupIdOptions}
              isEdit={selectedCalendar !== undefined}
              isNewCalendarIdValid={
                selectedCalendar || isNewCalendarIdValid === null ? true : isNewCalendarIdValid
              }
              jobIdOptions={jobIdOptions}
              onCalendarIdChange={this.onCalendarIdChange}
              onCreate={this.onCreate}
              onDescriptionChange={this.onDescriptionChange}
              onEdit={this.onEdit}
              onEventDelete={this.onEventDelete}
              onGroupSelection={this.onGroupSelection}
              showImportModal={this.showImportModal}
              onJobSelection={this.onJobSelection}
              saving={saving}
              loading={loading}
              selectedGroupOptions={selectedGroupOptions}
              selectedJobOptions={selectedJobOptions}
              onCreateGroupOption={this.onCreateGroupOption}
              showNewEventModal={this.showNewEventModal}
              isGlobalCalendar={isGlobalCalendar}
              onGlobalCalendarChange={this.onGlobalCalendarChange}
              addEvents={this.addEvents}
              clearEvents={this.clearEvents}
              isDst={this.props.isDst}
            />
            {modal}
          </EuiPageBody>
        </div>
        <HelpMenu docLink={helpLink} />
      </Fragment>
    );
  }
}

export const NewCalendar = withKibana(NewCalendarUI);
