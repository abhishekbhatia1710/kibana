/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import apm from 'elastic-apm-node';
import { Observable, fromEventPattern, lastValueFrom, of, throwError } from 'rxjs';
import { catchError, map, mergeMap, takeUntil, tap } from 'rxjs';

import type { LicenseType } from '@kbn/licensing-plugin/server';
import {
  LICENSE_TYPE_CLOUD_STANDARD,
  LICENSE_TYPE_ENTERPRISE,
  LICENSE_TYPE_GOLD,
  LICENSE_TYPE_PLATINUM,
  LICENSE_TYPE_TRIAL,
} from '@kbn/reporting-common';
import { TaskRunResult } from '@kbn/reporting-common/types';
import {
  JobParamsPDFDeprecated,
  PDF_JOB_TYPE,
  TaskPayloadPDF,
} from '@kbn/reporting-export-types-pdf-common';
import { ExportType, REPORTING_TRANSACTION_TYPE, RunTaskOpts } from '@kbn/reporting-server';

import { getCustomLogo } from './get_custom_logo';
import { getFullUrls } from './get_full_urls';
import { getTracker } from './pdf_tracker';
import { validateUrls } from './validate_urls';

/**
 * @deprecated
 */
export class PdfV1ExportType extends ExportType<JobParamsPDFDeprecated, TaskPayloadPDF> {
  id = 'printablePdf';
  name = 'PDF';
  jobType = PDF_JOB_TYPE;
  jobContentEncoding? = 'base64' as const;
  jobContentExtension = 'pdf' as const;
  validLicenses: LicenseType[] = [
    LICENSE_TYPE_TRIAL,
    LICENSE_TYPE_CLOUD_STANDARD,
    LICENSE_TYPE_GOLD,
    LICENSE_TYPE_PLATINUM,
    LICENSE_TYPE_ENTERPRISE,
  ];

  constructor(...args: ConstructorParameters<typeof ExportType>) {
    super(...args);
    this.logger = this.logger.get('png-export-v1');
  }

  public createJob = async (
    { relativeUrls, ...jobParams }: JobParamsPDFDeprecated // relativeUrls does not belong in the payload of PDFV1
  ) => {
    validateUrls(relativeUrls);

    // return the payload
    return {
      ...jobParams,
      isDeprecated: true,
      forceNow: new Date().toISOString(),
      objects: relativeUrls.map((u) => ({ relativeUrl: u })),
    };
  };

  public runTask = async ({
    jobId,
    payload: job,
    request,
    taskInstanceFields,
    cancellationToken,
    stream,
  }: RunTaskOpts<TaskPayloadPDF>) => {
    const logger = this.logger.get(`execute-job:${jobId}`);
    const apmTrans = apm.startTransaction('execute-job-pdf', REPORTING_TRANSACTION_TYPE);
    const apmGetAssets = apmTrans.startSpan('get-assets', 'setup');
    let apmGeneratePdf: { end: () => void } | null | undefined;

    const process$: Observable<TaskRunResult> = of(1).pipe(
      mergeMap(async () => {
        const uiSettingsClient = await this.getUiSettingsClient(request);
        return getCustomLogo(uiSettingsClient);
      }),
      mergeMap((logo) => {
        const urls = getFullUrls(this.getServerInfo(), this.config, job);

        const { browserTimezone, layout, title } = job;
        apmGetAssets?.end();

        apmGeneratePdf = apmTrans.startSpan('generate-pdf-pipeline', 'execute');

        const tracker = getTracker();
        tracker.startScreenshots();

        return this.startDeps
          .screenshotting!.getScreenshots({
            format: 'pdf',
            title,
            logo,
            urls,
            request,
            browserTimezone,
            layout,
            taskInstanceFields,
            logger,
          })
          .pipe(
            tap(({ metrics }) => {
              if (metrics.cpu) {
                tracker.setCpuUsage(metrics.cpu);
              }
              if (metrics.memory) {
                tracker.setMemoryUsage(metrics.memory);
              }
            }),
            mergeMap(async ({ data: buffer, errors, metrics, renderErrors }) => {
              tracker.endScreenshots();
              const warnings: string[] = [];
              if (errors) {
                warnings.push(...errors.map((error) => error.message));
              }
              if (renderErrors) {
                warnings.push(...renderErrors);
              }

              tracker.end();

              return {
                buffer,
                metrics,
                warnings,
              };
            })
          );
      }),
      tap(({ buffer }) => {
        apmGeneratePdf?.end();
        if (buffer) {
          stream.write(buffer);
        }
      }),
      map(({ metrics, warnings }) => ({
        content_type: 'application/pdf',
        metrics: { pdf: metrics },
        warnings,
      })),
      catchError((err: any) => {
        logger.error(err);
        return throwError(err);
      })
    );

    const stop$ = fromEventPattern(cancellationToken.on);

    apmTrans.end();
    return lastValueFrom(process$.pipe(takeUntil(stop$)));
  };
}
