/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getPrivilegedMonitorUsersJoin } from '../../../queries/helpers';

export const getAuthenticationsEsqlCount = (namespace: string) => {
  return `FROM logs-okta.system-* METADATA _id, _index
    ${getPrivilegedMonitorUsersJoin(namespace)}
    | WHERE user.name IS NOT NULL
    | EVAL event_combined = COALESCE(event.action, okta.event_type, event.category)
    | WHERE to_lower(event_combined) RLIKE ".*?(authn|authentication|sso|mfa|token\.grant|authorize\.code|session\.start|unauth_app_access_attempt|evaluate_sign_on|verify_push).*?"
    | STATS COUNT(*)`;
};
