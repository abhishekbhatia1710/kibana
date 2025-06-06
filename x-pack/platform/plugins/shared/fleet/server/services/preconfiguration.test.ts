/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { v4 as uuidv4 } from 'uuid';

import { elasticsearchServiceMock, loggingSystemMock } from '@kbn/core/server/mocks';

import { SavedObjectsErrorHelpers } from '@kbn/core/server';
import { DEFAULT_SPACE_ID } from '@kbn/spaces-plugin/common/constants';

import { createSavedObjectClientMock } from '../mocks';

import type {
  InstallResult,
  PackagePolicy,
  PreconfiguredAgentPolicy,
  RegistrySearchResult,
} from '../../common/types';
import type { AgentPolicy, NewPackagePolicy, Output, DownloadSource } from '../types';

import { LEGACY_AGENT_POLICY_SAVED_OBJECT_TYPE } from '../constants';

import { appContextService } from './app_context';

import * as agentPolicy from './agent_policy';

import {
  ensurePreconfiguredPackagesAndPolicies,
  comparePreconfiguredPolicyToCurrent,
} from './preconfiguration';
import { packagePolicyService } from './package_policy';
import { getBundledPackages } from './epm/packages/bundled_packages';
import { installPackage, type InstallPackageParams } from './epm/packages/install';

jest.mock('./agent_policy_update');
jest.mock('./output');
jest.mock('./epm/packages/bundled_packages');
jest.mock('./epm/archive');

const mockedPackagePolicyService = packagePolicyService as jest.Mocked<typeof packagePolicyService>;
const mockedGetBundledPackages = getBundledPackages as jest.MockedFunction<
  typeof getBundledPackages
>;

const mockInstalledPackages = new Map();
const mockInstallPackageErrors = new Map<string, string>();
const mockConfiguredPolicies = new Map();

const mockDefaultOutput: Output = {
  id: 'test-id',
  is_default: true,
  is_default_monitoring: false,
  name: 'default',
  // @ts-ignore
  type: 'elasticsearch',
  hosts: ['http://127.0.0.1:9201'],
};
const mockDefaultDownloadService: DownloadSource = {
  id: 'ds-test-id',
  is_default: true,
  name: 'default download source host',
  host: 'http://127.0.0.1:9201',
};

function getPutPreconfiguredPackagesMock() {
  const soClient = createSavedObjectClientMock();
  soClient.find.mockImplementation(async ({ type, search }) => {
    if (type === LEGACY_AGENT_POLICY_SAVED_OBJECT_TYPE) {
      const id = search!.replace(/"/g, '');
      const attributes = mockConfiguredPolicies.get(id);
      if (attributes) {
        return {
          saved_objects: [
            {
              id,
              attributes,
              type: type as string,
              score: 1,
              references: [],
            },
          ],
          total: 1,
          page: 1,
          per_page: 1,
        };
      }
    }
    return {
      saved_objects: [],
      total: 0,
      page: 1,
      per_page: 0,
    };
  });
  soClient.bulkGet.mockImplementation(async (objects) => {
    return {
      saved_objects: objects.map(({ id, type }) => {
        const attributes = mockConfiguredPolicies.get(id);
        if (!attributes) throw SavedObjectsErrorHelpers.createGenericNotFoundError(type, id);

        return {
          id,
          attributes,
          type: type as string,
          references: [],
        };
      }),
    };
  });
  soClient.create.mockImplementation(async (type, policy, options) => {
    const attributes = policy as AgentPolicy;
    const { id } = options!;
    mockConfiguredPolicies.set(id, attributes);
    return {
      id: id || uuidv4(),
      attributes,
      type,
      references: [],
    };
  });

  soClient.delete.mockResolvedValue({});

  return soClient;
}

jest.mock('./epm/registry', () => ({
  ...jest.requireActual('./epm/registry'),
  async fetchFindLatestPackageOrThrow(
    packageName: string,
    options?: { prerelease?: boolean }
  ): Promise<RegistrySearchResult> {
    let latestVersion = '1.0.0';
    if (options?.prerelease && packageName === 'test_package') {
      latestVersion = '3.0.1-beta.1';
    }

    return {
      name: packageName,
      version: latestVersion,
      description: '',
      release: 'experimental',
      title: '',
      path: '',
      download: '',
    };
  },
}));

jest.mock('./epm/packages/install', () => ({
  installPackage: jest.fn(
    async (args: InstallPackageParams): Promise<InstallResult | undefined> => {
      if (args.installSource === 'registry') {
        const [pkgName, pkgVersion] = args.pkgkey.split('-');
        const installError = mockInstallPackageErrors.get(pkgName);
        if (installError) {
          return {
            error: new Error(installError),
            installType: 'install',
            installSource: 'registry',
            pkgName,
          };
        }

        const installedPackage = mockInstalledPackages.get(pkgName);
        if (installedPackage) {
          if (installedPackage.version === pkgVersion) return installedPackage;
        }

        const packageInstallation = { name: pkgName, version: pkgVersion, title: pkgName };
        mockInstalledPackages.set(pkgName, packageInstallation);

        return {
          status: 'installed',
          installType: 'install',
          installSource: 'registry',
          pkgName,
        };
      } else if (args.installSource === 'upload') {
        const { archiveBuffer } = args;

        // Treat the buffer value passed in tests as the package's name for simplicity
        const pkgName = archiveBuffer.toString('utf8');

        // Just install every bundled package at version '1.0.0'
        const packageInstallation = { name: pkgName, version: '1.0.0', title: pkgName };
        mockInstalledPackages.set(pkgName, packageInstallation);

        return { status: 'installed', installType: 'install', installSource: 'upload', pkgName };
      }
    }
  ),
  ensurePackagesCompletedInstall() {
    return [];
  },
  isPackageVersionOrLaterInstalled({
    soClient,
    pkgName,
    pkgVersion,
  }: {
    soClient: any;
    pkgName: string;
    pkgVersion: string;
  }) {
    const installedPackage = mockInstalledPackages.get(pkgName);

    if (installedPackage) {
      if (installedPackage.version === pkgVersion) {
        return { package: installedPackage, installType: 'reinstall' };
      }

      // Importing semver methods throws an error in jest, so just use a rough check instead
      if (installedPackage.version < pkgVersion) {
        return false;
      }
      if (installedPackage.version > pkgVersion) {
        return { package: installedPackage, installType: 'rollback' };
      }
    }

    return false;
  },
  getInstallType: jest.fn(),
  async updateInstallStatus(soClient: any, pkgName: string, status: string) {
    const installedPackage = mockInstalledPackages.get(pkgName);

    if (!installedPackage) {
      return;
    }

    installedPackage.install_status = status;
  },
}));

jest.mock('./epm/packages/get', () => ({
  getPackageInfo({ pkgName }: { pkgName: string }) {
    const installedPackage = mockInstalledPackages.get(pkgName);
    if (!installedPackage) return { status: 'not_installed' };
    return {
      status: 'installed',
      ...installedPackage,
      policy_templates: [
        {
          name: 'test_template',
          inputs: [
            {
              type: 'foo',
              vars: [
                {
                  name: 'bar',
                  type: 'text',
                },
              ],
            },
          ],
        },
      ],
    };
  },
  getInstallation({ pkgName }: { pkgName: string }) {
    return mockInstalledPackages.get(pkgName) ?? false;
  },
  getInstallationObject({ pkgName }: { pkgName: string }) {
    return mockInstalledPackages.get(pkgName) ?? false;
  },
}));

jest.mock('./epm/kibana/index_pattern/install');

jest.mock('./package_policy', () => ({
  ...jest.requireActual('./package_policy'),
  packagePolicyService: {
    ...jest.requireActual('./package_policy').packagePolicyService,
    findAllForAgentPolicy: jest.fn().mockReturnValue([]),
    listIds: jest.fn().mockReturnValue({ items: [] }),
    create: jest
      .fn()
      .mockImplementation((soClient: any, esClient: any, newPackagePolicy: NewPackagePolicy) => {
        return {
          id: 'mocked',
          version: 'mocked',
          ...newPackagePolicy,
        };
      }),
    get(soClient: any, id: string) {
      return {
        id: 'mocked',
        version: 'mocked',
      };
    },
  },
}));

jest.mock('./app_context', () => ({
  appContextService: {
    getLogger: jest.fn(
      () =>
        new Proxy(
          {},
          {
            get() {
              return jest.fn();
            },
          }
        )
    ),
    getUninstallTokenService: () => ({
      generateTokenForPolicyId: jest.fn(),
      scoped: jest.fn().mockReturnValue({
        generateTokenForPolicyId: jest.fn(),
      }),
    }),
    getExternalCallbacks: jest.fn(),
    getCloud: jest.fn(),
    getConfig: jest.fn(),
    getExperimentalFeatures: jest.fn().mockReturnValue({}),
    getInternalUserSOClientForSpaceId: jest.fn(),
  },
}));

jest.mock('./audit_logging');

const spyAgentPolicyServiceUpdate = jest.spyOn(agentPolicy.agentPolicyService, 'update');
const spyAgentPolicyServicBumpAllAgentPoliciesForOutput = jest.spyOn(
  agentPolicy.agentPolicyService,
  'bumpAllAgentPoliciesForOutput'
);

describe('policy preconfiguration', () => {
  beforeEach(() => {
    jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReset();
    jest.mocked(appContextService).getLogger.mockReturnValue(loggingSystemMock.create().get());

    mockedPackagePolicyService.create.mockReset();
    mockedPackagePolicyService.findAllForAgentPolicy.mockReset();
    mockInstalledPackages.clear();
    mockInstallPackageErrors.clear();
    mockConfiguredPolicies.clear();
    spyAgentPolicyServiceUpdate.mockClear();
    spyAgentPolicyServicBumpAllAgentPoliciesForOutput.mockClear();
  });

  describe('with no bundled packages', () => {
    mockedGetBundledPackages.mockResolvedValue([]);

    it('should perform a no-op when passed no policies or packages', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      const { policies, packages, nonFatalErrors } = await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [],
        [],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(policies.length).toBe(0);
      expect(packages.length).toBe(0);
      expect(nonFatalErrors.length).toBe(0);
    });

    it('should install packages successfully', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      const { policies, packages, nonFatalErrors } = await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [],
        [{ name: 'test_package', version: '3.0.0' }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(policies.length).toBe(0);
      expect(packages).toEqual(expect.arrayContaining(['test_package-3.0.0']));
      expect(nonFatalErrors.length).toBe(0);
    });

    it('should install packages and configure agent policies successfully', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      const { policies, packages, nonFatalErrors } = await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [
          {
            name: 'Test policy',
            namespace: 'default',
            id: 'test-id',
            package_policies: [
              {
                package: { name: 'test_package' },
                name: 'Test package',
              },
            ],
          },
        ] as PreconfiguredAgentPolicy[],
        [{ name: 'test_package', version: '3.0.0' }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(policies.length).toEqual(1);
      expect(policies[0].id).toBe('test-id');
      expect(packages).toEqual(expect.arrayContaining(['test_package-3.0.0']));
      expect(nonFatalErrors.length).toBe(0);
    });

    it('should install packages and configure agent policies successfully if using simplified package policy', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      const { policies, packages, nonFatalErrors } = await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [
          {
            name: 'Test policy',
            namespace: 'default',
            id: 'test-id',
            package_policies: [
              {
                id: 'test-1',
                name: 'Test package',
                namespace: 'default',
                description: 'test',
                package: { name: 'test_package' },
                policy_ids: ['test-id'],
                inputs: {
                  'test_template-foo': {
                    vars: {
                      bar: 'test',
                    },
                  },
                },
              },
            ],
          },
        ] as PreconfiguredAgentPolicy[],
        [{ name: 'test_package', version: '3.0.0' }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(policies.length).toEqual(1);
      expect(policies[0].id).toBe('test-id');
      expect(packages).toEqual(expect.arrayContaining(['test_package-3.0.0']));
      expect(nonFatalErrors.length).toBe(0);

      expect(mockedPackagePolicyService.create).toBeCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          description: 'test',
          enabled: true,
          inputs: [
            {
              enabled: true,
              policy_template: 'test_template',
              streams: [],
              type: 'foo',
              vars: { bar: { type: 'text', value: 'test' } },
            },
          ],
          name: 'Test package',
          namespace: 'default',
          output_id: undefined,
          package: { name: 'test_package', title: 'test_package', version: '3.0.0' },
          policy_id: 'test-id',
          supports_agentless: undefined,
          vars: undefined,
        }),
        expect.objectContaining({ id: 'test-1' })
      );
    });

    it('should install prerelease packages if needed', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      const { policies, packages, nonFatalErrors } = await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [] as PreconfiguredAgentPolicy[],
        [{ name: 'test_package', version: 'latest', prerelease: true }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(policies.length).toEqual(0);
      expect(packages).toEqual(expect.arrayContaining(['test_package-3.0.1-beta.1']));
      expect(nonFatalErrors.length).toBe(0);
    });

    it('should pass skipDatastreamRollover flag if configured', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      const { policies, packages, nonFatalErrors } = await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [] as PreconfiguredAgentPolicy[],
        [{ name: 'test_package', version: 'latest', skipDataStreamRollover: true }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(policies.length).toEqual(0);
      expect(packages).toEqual(expect.arrayContaining(['test_package-1.0.0']));
      expect(nonFatalErrors.length).toBe(0);
      expect(jest.mocked(installPackage)).toBeCalledWith(
        expect.objectContaining({
          skipDataStreamRollover: true,
        })
      );
    });

    it('should not add new package policy to existing non managed policies', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);
      mockedPackagePolicyService.findAllForAgentPolicy.mockResolvedValue([
        { name: 'test_package1' } as PackagePolicy,
      ]);

      mockConfiguredPolicies.set('test-id', {
        name: 'Test policy',
        description: 'Test policy description',
        unenroll_timeout: 120,
        namespace: 'default',
        id: 'test-id',
        package_policies: [
          {
            name: 'test_package1',
          },
        ],
      } as PreconfiguredAgentPolicy);

      await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [
          {
            name: 'Test policy',
            namespace: 'default',
            id: 'test-id',
            is_managed: false,
            package_policies: [
              {
                package: { name: 'test_package' },
                name: 'test_package1',
              },
              {
                package: { name: 'test_package' },
                name: 'test_package2',
              },
            ],
          },
        ] as PreconfiguredAgentPolicy[],
        [{ name: 'test_package', version: '3.0.0' }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(mockedPackagePolicyService.create).not.toBeCalled();
    });

    it('should add new package policy to existing managed policies', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);
      mockedPackagePolicyService.findAllForAgentPolicy.mockResolvedValue([
        { name: 'test_package1' } as PackagePolicy,
      ]);

      mockConfiguredPolicies.set('test-id', {
        name: 'Test policy',
        description: 'Test policy description',
        unenroll_timeout: 120,
        namespace: 'default',
        id: 'test-id',
        package_policies: [
          {
            name: 'test_package1',
          },
        ],
        is_managed: true,
      } as PreconfiguredAgentPolicy);

      await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [
          {
            name: 'Test policy',
            namespace: 'default',
            id: 'test-id',
            is_managed: true,
            package_policies: [
              {
                package: { name: 'test_package' },
                name: 'test_package1',
              },
              {
                package: { name: 'test_package' },
                name: 'test_package2',
              },
            ],
          },
        ] as PreconfiguredAgentPolicy[],
        [{ name: 'test_package', version: '3.0.0' }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(mockedPackagePolicyService.create).toBeCalledTimes(1);
      expect(mockedPackagePolicyService.create).toBeCalledWith(
        expect.anything(), // so client
        expect.anything(), // es client
        expect.objectContaining({
          name: 'test_package2',
        }),
        expect.anything() // options
      );
    });

    it('should update keep_monitoring_enabled for existing managed policies', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);
      mockedPackagePolicyService.findAllForAgentPolicy.mockResolvedValue([
        { name: 'test_package1' } as PackagePolicy,
      ]);

      mockConfiguredPolicies.set('test-id', {
        name: 'Test policy',
        description: 'Test policy description',
        unenroll_timeout: 120,
        namespace: 'default',
        id: 'test-id',
        is_managed: true,
        package_policies: [
          {
            name: 'test_package1',
          },
        ],
      } as PreconfiguredAgentPolicy);

      await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [
          {
            name: 'Test policy',
            namespace: 'default',
            id: 'test-id',
            is_managed: true,
            keep_monitoring_alive: true,
            package_policies: [
              {
                package: { name: 'test_package' },
                name: 'test_package1',
              },
            ],
          },
        ] as PreconfiguredAgentPolicy[],
        [{ name: 'test_package', version: '3.0.0' }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(spyAgentPolicyServiceUpdate).toBeCalled();
      expect(spyAgentPolicyServiceUpdate).toBeCalledWith(
        expect.anything(), // soClient
        expect.anything(), // esClient
        'test-id',
        expect.objectContaining({
          download_source_id: 'ds-test-id',
          is_managed: true,
          keep_monitoring_alive: true,
          name: 'Test policy',
        }),
        {
          force: true,
        }
      );
    });

    it('should update keep_monitoring_enabled for existing managed policies (even is the SO is out-of-sync)', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);
      mockedPackagePolicyService.findAllForAgentPolicy.mockResolvedValue([
        { name: 'test_package1' } as PackagePolicy,
      ]);

      mockConfiguredPolicies.set('test-id', {
        name: 'Test policy',
        description: 'Test policy description',
        unenroll_timeout: 120,
        namespace: 'default',
        id: 'test-id',
        is_managed: false, // SO out-of-sync and mark the policy as not managed
        package_policies: [
          {
            name: 'test_package1',
          },
        ],
      } as PreconfiguredAgentPolicy);

      await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [
          {
            name: 'Test policy',
            namespace: 'default',
            id: 'test-id',
            is_managed: true,
            keep_monitoring_alive: true,
            package_policies: [
              {
                package: { name: 'test_package' },
                name: 'test_package1',
              },
            ],
          },
        ] as PreconfiguredAgentPolicy[],
        [{ name: 'test_package', version: '3.0.0' }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(spyAgentPolicyServiceUpdate).toBeCalled();
      expect(spyAgentPolicyServiceUpdate).toBeCalledWith(
        expect.anything(), // soClient
        expect.anything(), // esClient
        'test-id',
        expect.objectContaining({
          download_source_id: 'ds-test-id',
          is_managed: true,
          keep_monitoring_alive: true,
          name: 'Test policy',
        }),
        {
          force: true,
        }
      );
    });

    it('should not try to recreate preconfigure package policy that has been renamed', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);
      mockedPackagePolicyService.findAllForAgentPolicy.mockResolvedValue([
        { name: 'Renamed package policy', id: 'test_package1' } as PackagePolicy,
      ]);

      mockConfiguredPolicies.set('test-id', {
        name: 'Test policy',
        description: 'Test policy description',
        unenroll_timeout: 120,
        namespace: 'default',
        id: 'test-id',
        package_policies: [
          {
            name: 'test_package1',
            id: 'test_package1',
          },
        ],
        is_managed: true,
      } as PreconfiguredAgentPolicy);

      await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [
          {
            name: 'Test policy',
            namespace: 'default',
            id: 'test-id',
            is_managed: true,
            package_policies: [
              {
                package: { name: 'test_package' },
                name: 'test_package1',
                id: 'test_package1',
              },
            ],
          },
        ] as PreconfiguredAgentPolicy[],
        [{ name: 'test_package', version: '3.0.0' }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(mockedPackagePolicyService.create).not.toBeCalled();
    });

    it('should throw an error when trying to install duplicate packages', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      await expect(
        ensurePreconfiguredPackagesAndPolicies(
          soClient,
          esClient,
          [],
          [
            { name: 'test_package', version: '3.0.0' },
            { name: 'test_package', version: '2.0.0' },
          ],
          mockDefaultOutput,
          mockDefaultDownloadService,
          DEFAULT_SPACE_ID
        )
      ).rejects.toThrow(
        'Duplicate packages specified in configuration: test_package-3.0.0, test_package-2.0.0'
      );
    });

    it('should not create a policy and throw an error if install fails for required package', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);
      const policies: PreconfiguredAgentPolicy[] = [
        {
          name: 'Test policy',
          namespace: 'default',
          id: 'test-id',
          package_policies: [
            {
              package: { name: 'test_package' },
              name: 'Test package',
            },
          ],
        },
      ];
      mockInstallPackageErrors.set('test_package', 'REGISTRY ERROR');

      await expect(
        ensurePreconfiguredPackagesAndPolicies(
          soClient,
          esClient,
          policies,
          [{ name: 'test_package', version: '3.0.0' }],
          mockDefaultOutput,
          mockDefaultDownloadService,
          DEFAULT_SPACE_ID
        )
      ).rejects.toThrow(
        '[Test policy] could not be added. [test_package] could not be installed due to error: [Error: REGISTRY ERROR]'
      );
    });

    it('should not create a policy and throw an error if package is not installed for an unknown reason', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      const policies: PreconfiguredAgentPolicy[] = [
        {
          name: 'Test policy',
          namespace: 'default',
          id: 'test-id',
          package_policies: [
            {
              id: 'test-package',
              package: { name: 'test_package' },
              name: 'Test package',
            },
          ],
        },
      ];

      await expect(
        ensurePreconfiguredPackagesAndPolicies(
          soClient,
          esClient,
          policies,
          [{ name: 'CANNOT_MATCH', version: 'x.y.z' }],
          mockDefaultOutput,
          mockDefaultDownloadService,
          DEFAULT_SPACE_ID
        )
      ).rejects.toThrow(
        '[Test policy] could not be added. [test_package] is not installed, add [test_package] to [xpack.fleet.packages] or remove it from [Test package].'
      );
    });

    it('should not attempt to recreate or modify an agent policy if its ID is unchanged', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      const { policies: policiesA, nonFatalErrors: nonFatalErrorsA } =
        await ensurePreconfiguredPackagesAndPolicies(
          soClient,
          esClient,
          [
            {
              name: 'Test policy',
              namespace: 'default',
              id: 'test-id',
              package_policies: [],
            },
          ] as PreconfiguredAgentPolicy[],
          [],
          mockDefaultOutput,
          mockDefaultDownloadService,
          DEFAULT_SPACE_ID
        );

      expect(policiesA.length).toEqual(1);
      expect(policiesA[0].id).toBe('test-id');
      expect(nonFatalErrorsA.length).toBe(0);

      const { policies: policiesB, nonFatalErrors: nonFatalErrorsB } =
        await ensurePreconfiguredPackagesAndPolicies(
          soClient,
          esClient,
          [
            {
              name: 'Test policy redo',
              namespace: 'default',
              id: 'test-id',
              package_policies: [
                {
                  package: { name: 'some-uninstalled-package' },
                  name: 'This package is not installed',
                },
              ],
            },
          ] as PreconfiguredAgentPolicy[],
          [],
          mockDefaultOutput,
          mockDefaultDownloadService,
          DEFAULT_SPACE_ID
        );

      expect(policiesB.length).toEqual(1);
      expect(policiesB[0].id).toBe('test-id');
      expect(policiesB[0].updated_at).toEqual(policiesA[0].updated_at);
      expect(nonFatalErrorsB.length).toBe(0);
    });

    it('should update a managed policy if top level fields are changed', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      mockConfiguredPolicies.set('test-id', {
        name: 'Test policy',
        description: 'Test policy description',
        unenroll_timeout: 120,
        namespace: 'default',
        id: 'test-id',
        package_policies: [],
        is_managed: true,
      } as PreconfiguredAgentPolicy);

      const { policies, nonFatalErrors: nonFatalErrorsB } =
        await ensurePreconfiguredPackagesAndPolicies(
          soClient,
          esClient,
          [
            {
              name: 'Renamed Test policy',
              description: 'Renamed Test policy description',
              unenroll_timeout: 999,
              namespace: 'default',
              id: 'test-id',
              is_managed: true,
              package_policies: [],
            },
          ] as PreconfiguredAgentPolicy[],
          [],
          mockDefaultOutput,
          mockDefaultDownloadService,
          DEFAULT_SPACE_ID
        );
      expect(spyAgentPolicyServiceUpdate).toBeCalled();
      expect(spyAgentPolicyServiceUpdate).toBeCalledWith(
        expect.anything(), // soClient
        expect.anything(), // esClient
        'test-id',
        expect.objectContaining({
          name: 'Renamed Test policy',
          description: 'Renamed Test policy description',
          unenroll_timeout: 999,
        }),
        {
          force: true,
        }
      );
      expect(policies.length).toEqual(1);
      expect(policies[0].id).toBe('test-id');
      expect(nonFatalErrorsB.length).toBe(0);
    });

    it('should not update a managed policy if a top level field has not changed', async () => {
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);
      const policy: PreconfiguredAgentPolicy = {
        name: 'Test policy',
        namespace: 'default',
        id: 'test-id',
        package_policies: [],
        is_managed: true,
      };
      mockConfiguredPolicies.set('test-id', policy);

      const { policies, nonFatalErrors: nonFatalErrorsB } =
        await ensurePreconfiguredPackagesAndPolicies(
          soClient,
          esClient,
          [policy],
          [],
          mockDefaultOutput,
          mockDefaultDownloadService,
          DEFAULT_SPACE_ID
        );
      expect(spyAgentPolicyServiceUpdate).not.toBeCalled();
      expect(policies.length).toEqual(1);
      expect(policies[0].id).toBe('test-id');
      expect(nonFatalErrorsB.length).toBe(0);
    });

    it('should used a namespaced saved objet client if the agent policy space_id is set', async () => {
      const TEST_NAMESPACE = 'test';
      const namespacedSOClient = getPutPreconfiguredPackagesMock();
      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;

      jest
        .mocked(appContextService)
        .getInternalUserSOClientForSpaceId.mockReturnValue(namespacedSOClient);

      await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [
          {
            name: 'Test policy',
            namespace: 'default',
            id: 'test-id',
            space_id: TEST_NAMESPACE,
            is_managed: true,
            package_policies: [
              {
                package: { name: 'test_package' },
                name: 'test_package1',
              },
            ],
          },
        ] as PreconfiguredAgentPolicy[],
        [{ name: 'test_package', version: '3.0.0' }],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(appContextService.getInternalUserSOClientForSpaceId).toBeCalledTimes(1);
      expect(appContextService.getInternalUserSOClientForSpaceId).toBeCalledWith(TEST_NAMESPACE);

      expect(mockedPackagePolicyService.create).toBeCalledTimes(1);
      expect(mockedPackagePolicyService.create).toBeCalledWith(
        namespacedSOClient, // namespaced so client
        expect.anything(), // es client
        expect.objectContaining({
          name: 'test_package1',
        }),
        expect.anything() // options
      );

      expect(spyAgentPolicyServiceUpdate).toBeCalledTimes(1);
      expect(spyAgentPolicyServiceUpdate).toBeCalledWith(
        namespacedSOClient, // namespaced so client
        expect.anything(), // es client
        expect.anything(), // id
        expect.objectContaining({
          is_managed: true,
        }),
        expect.anything() // options
      );
    });
  });

  describe('with bundled packages', () => {
    beforeEach(() => {
      mockInstalledPackages.clear();
      mockedGetBundledPackages.mockReset();
    });

    it('should install each bundled package', async () => {
      mockedGetBundledPackages.mockResolvedValue([
        {
          name: 'test_package',
          version: '1.0.0',
          getBuffer: () => Promise.resolve(Buffer.from('test_package')),
        },

        {
          name: 'test_package_2',
          version: '1.0.0',
          getBuffer: () => Promise.resolve(Buffer.from('test_package_2')),
        },
      ]);

      const soClient = getPutPreconfiguredPackagesMock();
      const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
      jest.mocked(appContextService).getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

      const { policies, packages, nonFatalErrors } = await ensurePreconfiguredPackagesAndPolicies(
        soClient,
        esClient,
        [],
        [
          {
            name: 'test_package',
            version: 'latest',
          },
          {
            name: 'test_package_2',
            version: 'latest',
          },
        ],
        mockDefaultOutput,
        mockDefaultDownloadService,
        DEFAULT_SPACE_ID
      );

      expect(policies).toEqual([]);
      expect(packages).toEqual(['test_package-1.0.0', 'test_package_2-1.0.0']);
      expect(nonFatalErrors).toEqual([]);
    });

    describe('package updates', () => {
      describe('when bundled package is a newer version', () => {
        it('installs new version of package from disk', async () => {
          mockedGetBundledPackages.mockResolvedValue([
            {
              name: 'test_package',
              version: '1.0.0',
              getBuffer: () => Promise.resolve(Buffer.from('test_package')),
            },
          ]);

          const soClient = getPutPreconfiguredPackagesMock();
          const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;
          jest
            .mocked(appContextService)
            .getInternalUserSOClientForSpaceId.mockReturnValue(soClient);

          // Install an older version of a test package
          mockInstalledPackages.set('test_package', {
            version: '0.9.0',
          });

          const { policies, packages, nonFatalErrors } =
            await ensurePreconfiguredPackagesAndPolicies(
              soClient,
              esClient,
              [],
              [
                {
                  name: 'test_package',
                  version: 'latest',
                },
              ],
              mockDefaultOutput,
              mockDefaultDownloadService,
              DEFAULT_SPACE_ID
            );

          // Package version should be updated
          expect(mockInstalledPackages.get('test_package').version).toEqual('1.0.0');

          expect(policies).toEqual([]);
          expect(packages).toEqual(['test_package-1.0.0']);
          expect(nonFatalErrors).toEqual([]);
        });
      });

      describe('when bundled package is not a newer version', () => {
        it('does not install package from disk', async () => {
          mockedGetBundledPackages.mockResolvedValue([
            {
              name: 'test_package',
              version: '1.0.0',
              getBuffer: () => Promise.resolve(Buffer.from('test_package')),
            },
          ]);

          const soClient = getPutPreconfiguredPackagesMock();
          const esClient = elasticsearchServiceMock.createClusterClient().asInternalUser;

          // Install an newer version of a test package
          mockInstalledPackages.set('test_package', {
            version: '2.0.0',
            name: 'test_package',
            installed_es: [],
            installed_kibana: [],
          });

          const { policies, packages, nonFatalErrors } =
            await ensurePreconfiguredPackagesAndPolicies(
              soClient,
              esClient,
              [],
              [
                {
                  name: 'test_package',
                  version: 'latest',
                },
              ],
              mockDefaultOutput,
              mockDefaultDownloadService,
              DEFAULT_SPACE_ID
            );

          // Package version should be unchanged
          expect(mockInstalledPackages.get('test_package').version).toEqual('2.0.0');

          expect(packages).toEqual(['test_package-2.0.0']);
          expect(policies).toEqual([]);
          expect(nonFatalErrors).toEqual([]);
        });
      });
    });
  });
});

describe('comparePreconfiguredPolicyToCurrent', () => {
  const baseConfig = {
    name: 'Test policy',
    namespace: 'default',
    description: 'This is a test policy',
    id: 'test-id',
    unenroll_timeout: 60,
    package_policies: [
      {
        package: { name: 'test_package' },
        name: 'Test package',
      },
    ],
  };

  const basePackagePolicy: AgentPolicy = {
    id: 'test-id',
    namespace: 'default',
    monitoring_enabled: ['logs', 'metrics'],
    name: 'Test policy',
    description: 'This is a test policy',
    unenroll_timeout: 60,
    inactivity_timeout: 60,
    is_preconfigured: true,
    status: 'active',
    is_managed: true,
    revision: 1,
    updated_at: '2021-07-07T16:29:55.144Z',
    updated_by: 'system',
    package_policies: [
      {
        package: { name: 'test_package', title: 'Test package', version: '1.0.0' },
        name: 'Test package',
        namespace: 'default',
        enabled: true,
        id: 'test-package-id',
        revision: 1,
        updated_at: '2021-07-07T16:29:55.144Z',
        updated_by: 'system',
        created_at: '2021-07-07T16:29:55.144Z',
        created_by: 'system',
        inputs: [],
        policy_id: 'abc123',
        policy_ids: ['abc123'],
      },
    ],
    is_protected: false,
  };

  it('should return hasChanged when a top-level policy field changes', () => {
    const { hasChanged } = comparePreconfiguredPolicyToCurrent(
      { ...baseConfig, unenroll_timeout: 120 },
      basePackagePolicy
    );
    expect(hasChanged).toBe(true);
  });

  it('should not return hasChanged when no top-level fields change', () => {
    const { hasChanged } = comparePreconfiguredPolicyToCurrent(
      {
        ...baseConfig,
        package_policies: [
          {
            package: { name: 'different_package' },
            name: 'Different package',
          },
        ],
      },
      basePackagePolicy
    );
    expect(hasChanged).toBe(false);
  });
});
