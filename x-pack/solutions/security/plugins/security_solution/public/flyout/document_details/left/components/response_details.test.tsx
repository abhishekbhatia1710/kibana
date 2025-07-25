/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DocumentDetailsContext } from '../../shared/context';
import { rawEventData, TestProviders } from '../../../../common/mock';
import { RESPONSE_DETAILS_TEST_ID } from './test_ids';
import { ResponseDetails } from './response_details';

jest.mock('../../../../common/hooks/use_experimental_features');
jest.mock('../../../../common/lib/kibana', () => {
  const originalModule = jest.requireActual('../../../../common/lib/kibana');
  return {
    ...originalModule,
    useKibana: jest.fn().mockReturnValue({
      services: {
        data: {
          search: {
            search: () => ({
              subscribe: () => ({
                unsubscribe: jest.fn(),
              }),
            }),
          },
        },
        osquery: {
          OsqueryResults: jest.fn().mockReturnValue(null),
          fetchAllLiveQueries: jest.fn().mockReturnValue({
            data: {
              data: {
                items: [
                  {
                    _id: 'testId',
                    _index: 'testIndex',
                    fields: {
                      action_id: ['testActionId'],
                      'queries.action_id': ['testQueryActionId'],
                      'queries.query': ['select * from users'],
                      '@timestamp': ['2022-09-08T18:16:30.256Z'],
                    },
                  },
                ],
              },
            },
          }),
        },
        sessionView: {
          getSessionView: jest.fn(() => <div />),
        },
      },
    }),
  };
});

const NO_DATA_MESSAGE =
  "There are no response actions defined for this event. To add some, edit the rule's settings and set up response actions(external, opens in a new tab or window).";
const PREVIEW_MESSAGE = 'Response is not available in alert preview.';

const defaultContextValue = {
  dataAsNestedObject: {
    _id: 'test',
  },
  searchHit: rawEventData,
} as unknown as DocumentDetailsContext;

const contextWithResponseActions = {
  ...defaultContextValue,
  searchHit: {
    ...rawEventData,
    fields: {
      ...rawEventData.fields,
      'agent.id': ['testAgent'],
      'kibana.alert.rule.name': ['test-rule'],
      'kibana.alert.rule.parameters': [
        {
          response_actions: [{ action_type_id: '.osquery' }],
        },
      ],
    },
  },
};

// Renders System Under Test
const renderResponseDetails = (contextValue: DocumentDetailsContext) =>
  render(
    <TestProviders>
      <DocumentDetailsContext.Provider value={contextValue}>
        <ResponseDetails />
      </DocumentDetailsContext.Provider>
    </TestProviders>
  );

describe('<ResponseDetails />', () => {
  it('should render the view with response actions', () => {
    const wrapper = renderResponseDetails(contextWithResponseActions);

    expect(wrapper.getByTestId(RESPONSE_DETAILS_TEST_ID)).toBeInTheDocument();
    expect(wrapper.getByTestId('responseActionsViewWrapper')).toBeInTheDocument();
    expect(wrapper.queryByTestId('osqueryViewWrapper')).not.toBeInTheDocument();
    // TODO mock osquery results
  });

  it('should render the empty information', () => {
    const wrapper = renderResponseDetails(defaultContextValue);

    expect(wrapper.getByTestId(RESPONSE_DETAILS_TEST_ID)).toBeInTheDocument();
    expect(wrapper.queryByTestId('responseActionsViewWrapper')).toBeInTheDocument();
    expect(wrapper.queryByTestId('osqueryViewWrapper')).not.toBeInTheDocument();

    expect(wrapper.getByTestId(RESPONSE_DETAILS_TEST_ID)).toHaveTextContent(NO_DATA_MESSAGE);
  });

  it('should render preview message if flyout is in preview', () => {
    const wrapper = renderResponseDetails({ ...defaultContextValue, isRulePreview: true });
    expect(wrapper.getByTestId(RESPONSE_DETAILS_TEST_ID)).toBeInTheDocument();
    expect(wrapper.getByTestId(RESPONSE_DETAILS_TEST_ID)).toHaveTextContent(PREVIEW_MESSAGE);
  });
});
