/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';

import { Decorator } from '@storybook/react';
import { I18nProvider } from '@kbn/i18n-react';

import { EuiThemeProvider } from '@kbn/kibana-react-plugin/common/eui_styled_components';
import { servicesFactory } from '../public/services/storybook';
import { CustomIntegrationsServicesProvider } from '../public/services';

/**
 * Returns a Storybook Decorator that provides both the `I18nProvider` and access to `PluginServices`
 * for components rendered in Storybook.
 */
export const getCustomIntegrationsContextDecorator: Decorator = (story, { globals }) => {
  const ContextProvider = getCustomIntegrationsContextProvider();
  const darkMode = globals.euiTheme === 'v8.dark' || globals.euiTheme === 'v7.dark';

  return (
    <I18nProvider>
      <EuiThemeProvider darkMode={darkMode}>
        <ContextProvider>{story()}</ContextProvider>
      </EuiThemeProvider>
    </I18nProvider>
  );
};

/**
 * Prepares `PluginServices` for use in Storybook and returns a React `Context.Provider` element
 * so components that access `PluginServices` can be rendered.
 */
export const getCustomIntegrationsContextProvider = () => {
  const services = servicesFactory({});
  return ({ children }: { children?: React.ReactNode }) => (
    <CustomIntegrationsServicesProvider {...services}>
      {children}
    </CustomIntegrationsServicesProvider>
  );
};
