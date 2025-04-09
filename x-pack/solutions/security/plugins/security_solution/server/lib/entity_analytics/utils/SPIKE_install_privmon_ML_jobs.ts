/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';

let client: ElasticsearchClient;

export function setElasticsearchClient(esClient: ElasticsearchClient) {
  client = esClient;
}

export async function installPADIntegration(): Promise<boolean> {
  try {
    const response = (await client.transport.request({
      method: 'POST',
      path: '/api/fleet/epm/packages/pad/1.0.0',
    })) as { statusCode: number };
    return response.statusCode === 200;
  } catch (error) {
    console.error('Failed to install PAD integration:', error);
    return false;
  }
}

export async function createPADComponentTemplates(): Promise<void> {
  try {
    await client.cluster.putComponentTemplate({
      name: 'pad-component-template',
      body: {
        template: {
          settings: {
            index: {
              number_of_shards: 1,
              number_of_replicas: 1,
            },
          },
        },
      },
    });
    console.log('PAD component template created successfully.');
  } catch (error) {
    console.error('Failed to create PAD component template:', error);
  }
}

export async function createPADIndexTemplate(): Promise<void> {
  try {
    await client.indices.putIndexTemplate({
      name: 'pad-index-template',
      index_patterns: ['privileged_access_detection-*'],
      template: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
        },
      },
    });
    console.log('PAD index template created successfully.');
  } catch (error) {
    console.error('Failed to create PAD index template:', error);
  }
}

export async function createPADIndices(): Promise<void> {
  try {
    await client.indices.create({
      index: 'privileged_access_detection-*',
      mappings: {
        properties: {
          '@timestamp': { type: 'date' },
          user: { type: 'keyword' },
          action: { type: 'keyword' },
        },
      },
    });
    console.log('PAD indices created successfully.');
  } catch (error) {
    console.error('Failed to create PAD indices:', error);
  }
}

export async function setupRollupJob(jobId: string): Promise<void> {
  try {
    const rollupParams = {
      id: jobId,
      body: {
        index_pattern: 'privileged_access_detection-*',
        rollup_index: 'rolled-privileged_access_detection',
        cron: '0 0 0 * * ?',
        page_size: 1000,
        groups: [
          {
            date_histogram: {
              field: '@timestamp',
              calendar_interval: '1d',
            },
          },
        ],
        metrics: [],
      },
    };
    await client.rollup.putJob(rollupParams);
    console.log('PAD rollup job set up successfully.');
  } catch (error) {
    console.error('Failed to set up PAD rollup job:', error);
  }
}

export async function startPADMLJobs(jobId: string): Promise<void> {
  try {
    await client.ml.openJob({ job_id: jobId });
    await client.ml.startDatafeed({ datafeed_id: `datafeed-${jobId}` });
    console.log('PAD ML jobs started successfully.');
  } catch (error) {
    console.error('Failed to start PAD ML jobs:', error);
  }
}

export async function verifyPADInstallation(): Promise<void> {
  try {
    const indexExists = await client.indices.exists({ index: 'privileged_access_detection-*' });
    const jobStats = await client.ml.getJobStats({ job_id: 'pad-ml-job-id' });
    console.log('PAD installation verification:', { indexExists, jobStats });
  } catch (error) {
    console.error('Failed to verify PAD installation:', error);
  }
}

export async function setupPrivilegedMonitoringEngine(): Promise<void> {
  try {
    console.log('Installing PAD integration...');
    const installed = await installPADIntegration();
    if (!installed) {
      console.error('Failed to install PAD integration. Aborting setup.');
      return;
    }

    console.log('Creating PAD component templates...');
    await createPADComponentTemplates();

    console.log('Creating PAD index template...');
    await createPADIndexTemplate();

    console.log('Creating PAD indices...');
    await createPADIndices();

    console.log('Setting up PAD rollup job...');
    await setupRollupJob('pad-rollup-job');

    console.log('Starting PAD ML jobs...');
    await startPADMLJobs('pad-ml-job-id');

    console.log('Verifying PAD installation...');
    await verifyPADInstallation();

    console.log('Privileged Monitoring Engine setup completed successfully.');
  } catch (error) {
    console.error('Failed to set up Privileged Monitoring Engine:', error);
  }
}
