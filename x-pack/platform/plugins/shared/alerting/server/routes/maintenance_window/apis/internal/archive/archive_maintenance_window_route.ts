/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IRouter } from '@kbn/core/server';
import type { ILicenseState } from '../../../../../lib';
import { verifyAccessAndContext } from '../../../../lib';
import type { AlertingRequestHandlerContext } from '../../../../../types';
import { INTERNAL_ALERTING_API_MAINTENANCE_WINDOW_PATH } from '../../../../../types';
import { MAINTENANCE_WINDOW_API_PRIVILEGES } from '../../../../../../common';
import type { MaintenanceWindow } from '../../../../../application/maintenance_window/types';

import type {
  ArchiveMaintenanceWindowRequestBodyV1,
  ArchiveMaintenanceWindowRequestParamsV1,
  ArchiveMaintenanceWindowResponseV1,
} from '../../../../../../common/routes/maintenance_window/internal/apis/archive';
import {
  archiveBodySchemaV1,
  archiveParamsSchemaV1,
} from '../../../../../../common/routes/maintenance_window/internal/apis/archive';
import { transformInternalMaintenanceWindowToExternalV1 } from '../transforms';

export const archiveMaintenanceWindowRoute = (
  router: IRouter<AlertingRequestHandlerContext>,
  licenseState: ILicenseState
) => {
  router.post(
    {
      path: `${INTERNAL_ALERTING_API_MAINTENANCE_WINDOW_PATH}/{id}/_archive`,
      validate: {
        params: archiveParamsSchemaV1,
        body: archiveBodySchemaV1,
      },
      security: {
        authz: {
          requiredPrivileges: [`${MAINTENANCE_WINDOW_API_PRIVILEGES.WRITE_MAINTENANCE_WINDOW}`],
        },
      },
      options: {
        access: 'internal',
      },
    },
    router.handleLegacyErrors(
      verifyAccessAndContext(licenseState, async function (context, req, res) {
        licenseState.ensureLicenseForMaintenanceWindow();

        const params: ArchiveMaintenanceWindowRequestParamsV1 = req.params;
        const body: ArchiveMaintenanceWindowRequestBodyV1 = req.body;

        const maintenanceWindowClient = (await context.alerting).getMaintenanceWindowClient();

        const maintenanceWindow: MaintenanceWindow = await maintenanceWindowClient.archive({
          id: params.id,
          archive: body.archive,
        });

        const response: ArchiveMaintenanceWindowResponseV1 = {
          body: transformInternalMaintenanceWindowToExternalV1(maintenanceWindow),
        };

        return res.ok(response);
      })
    )
  );
};
