/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiHeaderLink } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import React from 'react';
import { useKibana } from '@kbn/kibana-react-plugin/public';

export function UXAddData() {
  const kibana = useKibana();

  return (
    <EuiHeaderLink
      aria-label={i18n.translate('xpack.exploratoryView.page_header.addUXDataLink.label', {
        defaultMessage: 'Navigate to a tutorial about adding user experience APM data',
      })}
      href={kibana.services?.application?.getUrlForApp('/apm/tutorial')}
      color="primary"
    >
      {ADD_DATA_LABEL}
    </EuiHeaderLink>
  );
}

const ADD_DATA_LABEL = i18n.translate('xpack.exploratoryView.ux.addDataButtonLabel', {
  defaultMessage: 'Add UX data',
});
