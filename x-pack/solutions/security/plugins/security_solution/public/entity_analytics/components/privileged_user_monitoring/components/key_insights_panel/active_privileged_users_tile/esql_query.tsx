/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getPrivilegedMonitorUsersJoin } from '../../../helpers';

export const getActivePrivilegedUsersEsqlCount = (namespace: string) => {
  return `FROM logs-* METADATA _id, _index
      ${getPrivilegedMonitorUsersJoin(namespace)}
      | STATS COUNT_DISTINCT(user.name)`;
};
