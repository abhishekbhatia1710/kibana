/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FtrProviderContext } from '../../common/ftr_provider_context';
import { SPACES } from '../../common/lib/spaces';
import type { DisableLegacyUrlAliasesTestCase } from '../../common/suites/disable_legacy_url_aliases';
import {
  disableLegacyUrlAliasesTestSuiteFactory,
  TEST_CASE_SOURCE_ID,
  TEST_CASE_TARGET_TYPE,
} from '../../common/suites/disable_legacy_url_aliases';

const {
  DEFAULT: { spaceId: DEFAULT_SPACE_ID },
  SPACE_1: { spaceId: SPACE_1_ID },
  SPACE_2: { spaceId: SPACE_2_ID },
} = SPACES;

const createTestCases = (): DisableLegacyUrlAliasesTestCase[] => {
  const baseCase = { targetType: TEST_CASE_TARGET_TYPE, sourceId: TEST_CASE_SOURCE_ID };
  return [
    { ...baseCase, targetSpace: DEFAULT_SPACE_ID, expectFound: true }, // alias exists in the default space and should have been disabled
    { ...baseCase, targetSpace: SPACE_1_ID, expectFound: false }, // alias does not exist in space_1
    { ...baseCase, targetSpace: SPACE_2_ID, expectFound: true }, // alias exists in space_2 and should have been disabled
  ];
};

export default function ({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const esArchiver = getService('esArchiver');
  const es = getService('es');

  const { addTests, createTestDefinitions } = disableLegacyUrlAliasesTestSuiteFactory(
    es,
    esArchiver,
    supertest
  );

  const testCases = createTestCases();
  const tests = createTestDefinitions(testCases, false);
  addTests(`_disable_legacy_url_aliases`, { tests });
}
