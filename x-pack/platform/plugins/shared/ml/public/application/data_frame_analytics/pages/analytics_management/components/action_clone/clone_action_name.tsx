/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiToolTip, EuiLink, EuiText } from '@elastic/eui';
import type { FC } from 'react';
import React from 'react';
import { cloneDeep, isEqual } from 'lodash';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { extractErrorMessage } from '@kbn/ml-error-utils';
import {
  isClassificationAnalysis,
  isOutlierAnalysis,
  isRegressionAnalysis,
  DEFAULT_RESULTS_FIELD,
  type DataFrameAnalyticsConfig,
} from '@kbn/ml-data-frame-analytics-utils';
import { toMountPoint } from '@kbn/react-kibana-mount';
import type { DeepReadonly } from '../../../../../../../common/types/common';
import { useMlKibana, useMlManagementLocator } from '../../../../../contexts/kibana';
import { DEFAULT_NUM_TOP_FEATURE_IMPORTANCE_VALUES } from '../../hooks/use_create_analytics_form';
import type { State } from '../../hooks/use_create_analytics_form/state';
import type { DataFrameAnalyticsListRow } from '../analytics_list/common';

interface PropDefinition {
  /**
   * Indicates if the property is optional
   */
  optional: boolean;
  /**
   * Corresponding property from the form
   */
  formKey?: keyof State['form'];
  /**
   * Default value of the property
   */
  defaultValue?: any;
  /**
   * Indicates if the value has to be ignored
   * during detecting advanced configuration
   */
  ignore?: boolean;
}

function isPropDefinition(a: PropDefinition | object): a is PropDefinition {
  return Object.hasOwn(a, 'optional');
}

interface AnalyticsJobMetaData {
  [key: string]: PropDefinition | AnalyticsJobMetaData;
}

/**
 * Provides a config definition.
 */
const getAnalyticsJobMeta = (config: CloneDataFrameAnalyticsConfig): AnalyticsJobMetaData => ({
  allow_lazy_start: {
    optional: true,
    defaultValue: false,
  },
  description: {
    optional: true,
    formKey: 'description',
  },
  _meta: {
    optional: true,
    defaultValue: config._meta,
  },
  analysis: {
    ...(isClassificationAnalysis(config.analysis)
      ? {
          classification: {
            dependent_variable: {
              optional: false,
              formKey: 'dependentVariable',
            },
            training_percent: {
              optional: true,
              formKey: 'trainingPercent',
            },
            eta: {
              optional: true,
              formKey: 'eta',
            },
            feature_bag_fraction: {
              optional: true,
              formKey: 'featureBagFraction',
            },
            max_trees: {
              optional: true,
              formKey: 'maxTrees',
            },
            gamma: {
              optional: true,
              formKey: 'gamma',
            },
            lambda: {
              optional: true,
              formKey: 'lambda',
            },
            num_top_classes: {
              optional: true,
              defaultValue: 2,
              formKey: 'numTopClasses',
            },
            prediction_field_name: {
              optional: true,
              defaultValue: `${config.analysis.classification.dependent_variable}_prediction`,
              formKey: 'predictionFieldName',
            },
            randomize_seed: {
              optional: true,
              // By default it is randomly generated
              ignore: true,
              formKey: 'randomizeSeed',
            },
            num_top_feature_importance_values: {
              optional: true,
              defaultValue: DEFAULT_NUM_TOP_FEATURE_IMPORTANCE_VALUES,
              formKey: 'numTopFeatureImportanceValues',
            },
            class_assignment_objective: {
              optional: true,
              defaultValue: 'maximize_minimum_recall',
            },
            early_stopping_enabled: {
              optional: true,
              ignore: true,
            },
            alpha: {
              optional: true,
              formKey: 'alpha',
            },
            downsample_factor: {
              optional: true,
              formKey: 'downsampleFactor',
            },
            eta_growth_rate_per_tree: {
              optional: true,
              formKey: 'etaGrowthRatePerTree',
            },
            feature_processors: {
              optional: true,
            },
            max_optimization_rounds_per_hyperparameter: {
              optional: true,
              formKey: 'maxOptimizationRoundsPerHyperparameter',
            },
            soft_tree_depth_limit: {
              optional: true,
              formKey: 'softTreeDepthLimit',
            },
            soft_tree_depth_tolerance: {
              optional: true,
              formKey: 'softTreeDepthTolerance',
            },
          },
        }
      : {}),
    ...(isOutlierAnalysis(config.analysis)
      ? {
          outlier_detection: {
            standardization_enabled: {
              defaultValue: true,
              optional: true,
              formKey: 'standardizationEnabled',
            },
            compute_feature_influence: {
              defaultValue: true,
              optional: true,
              formKey: 'computeFeatureInfluence',
            },
            outlier_fraction: {
              defaultValue: 0.05,
              optional: true,
              formKey: 'outlierFraction',
            },
            feature_influence_threshold: {
              optional: true,
              formKey: 'featureInfluenceThreshold',
            },
            method: {
              optional: true,
              formKey: 'method',
            },
            n_neighbors: {
              optional: true,
              formKey: 'nNeighbors',
            },
          },
        }
      : {}),
    ...(isRegressionAnalysis(config.analysis)
      ? {
          regression: {
            dependent_variable: {
              optional: false,
              formKey: 'dependentVariable',
            },
            training_percent: {
              optional: true,
              formKey: 'trainingPercent',
            },
            eta: {
              optional: true,
              formKey: 'eta',
            },
            feature_bag_fraction: {
              optional: true,
              formKey: 'featureBagFraction',
            },
            max_trees: {
              optional: true,
              formKey: 'maxTrees',
            },
            gamma: {
              optional: true,
              formKey: 'gamma',
            },
            lambda: {
              optional: true,
              formKey: 'lambda',
            },
            prediction_field_name: {
              optional: true,
              defaultValue: `${config.analysis.regression.dependent_variable}_prediction`,
              formKey: 'predictionFieldName',
            },
            num_top_feature_importance_values: {
              optional: true,
              defaultValue: DEFAULT_NUM_TOP_FEATURE_IMPORTANCE_VALUES,
              formKey: 'numTopFeatureImportanceValues',
            },
            randomize_seed: {
              optional: true,
              // By default it is randomly generated
              ignore: true,
              formKey: 'randomizeSeed',
            },
            loss_function: {
              optional: true,
              defaultValue: 'mse',
            },
            loss_function_parameter: {
              optional: true,
            },
            feature_processors: {
              optional: true,
            },
            early_stopping_enabled: {
              optional: true,
              ignore: true,
            },
            alpha: {
              optional: true,
              formKey: 'alpha',
            },
            downsample_factor: {
              optional: true,
              formKey: 'downsampleFactor',
            },
            eta_growth_rate_per_tree: {
              optional: true,
              formKey: 'etaGrowthRatePerTree',
            },
            max_optimization_rounds_per_hyperparameter: {
              optional: true,
              formKey: 'maxOptimizationRoundsPerHyperparameter',
            },
            soft_tree_depth_limit: {
              optional: true,
              formKey: 'softTreeDepthLimit',
            },
            soft_tree_depth_tolerance: {
              optional: true,
              formKey: 'softTreeDepthTolerance',
            },
          },
        }
      : {}),
  },
  analyzed_fields: {
    excludes: {
      optional: true,
      defaultValue: [],
    },
    includes: {
      optional: true,
      formKey: 'includes',
      defaultValue: [],
    },
  },
  source: {
    index: {
      formKey: 'sourceIndex',
      optional: false,
    },
    query: {
      optional: true,
      defaultValue: {
        match_all: {},
      },
    },
    runtime_mappings: {
      optional: true,
      formKey: 'runtimeMappings',
      defaultValue: undefined,
    },
    _source: {
      optional: true,
    },
  },
  dest: {
    index: {
      optional: false,
      formKey: 'destinationIndex',
    },
    results_field: {
      optional: true,
      formKey: 'resultsField',
      defaultValue: DEFAULT_RESULTS_FIELD,
    },
  },
  model_memory_limit: {
    optional: true,
    formKey: 'modelMemoryLimit',
  },
  max_num_threads: {
    optional: true,
    formKey: 'maxNumThreads',
  },
});

/**
 * Detects if analytics job configuration were created with
 * the advanced editor and not supported by the regular form.
 */
export function isAdvancedConfig(config: any, meta?: AnalyticsJobMetaData): boolean;
export function isAdvancedConfig(
  config: CloneDataFrameAnalyticsConfig,
  meta: AnalyticsJobMetaData = getAnalyticsJobMeta(config)
): boolean {
  for (const configKey in config) {
    if (Object.hasOwn(config, configKey)) {
      const fieldConfig = config[configKey as keyof typeof config];
      const fieldMeta = meta[configKey as keyof typeof meta];

      if (!fieldMeta) {
        // eslint-disable-next-line no-console
        console.info(`Property "${configKey}" is unknown.`);
        return true;
      }

      if (isPropDefinition(fieldMeta)) {
        const isAdvancedSetting =
          fieldMeta.formKey === undefined &&
          fieldMeta.ignore !== true &&
          !isEqual(fieldMeta.defaultValue, fieldConfig);

        if (isAdvancedSetting) {
          // eslint-disable-next-line no-console
          console.info(
            `Property "${configKey}" is not supported by the form or has a different value to the default.`
          );
          return true;
        }
      } else if (isAdvancedConfig(fieldConfig, fieldMeta)) {
        return true;
      }
    }
  }
  return false;
}

export type CloneDataFrameAnalyticsConfig = Omit<
  DataFrameAnalyticsConfig,
  'id' | 'version' | 'create_time'
>;

/**
 * Gets complete original configuration as an input
 * and returns the config for cloning omitting
 * non-relevant parameters and resetting the destination index.
 */
export function extractCloningConfig({
  id,
  ...configToClone
}: DeepReadonly<DataFrameAnalyticsConfig>): CloneDataFrameAnalyticsConfig {
  return cloneDeep({
    ...configToClone,
    dest: {
      ...configToClone.dest,
      // Reset the destination index
      index: '',
    },
  }) as unknown as CloneDataFrameAnalyticsConfig;
}

export const cloneActionNameText = i18n.translate(
  'xpack.ml.dataframe.analyticsList.cloneActionNameText',
  {
    defaultMessage: 'Clone',
  }
);

export const useNavigateToWizardWithClonedJob = () => {
  const {
    services: {
      notifications: { toasts },
      data: { dataViews },
      http: { basePath },
      application: { capabilities },
      ...startServices
    },
  } = useMlKibana();
  const mlLocator = useMlManagementLocator();
  const canCreateDataView =
    capabilities.savedObjectsManagement.edit === true || capabilities.indexPatterns.save === true;

  return async (item: Pick<DataFrameAnalyticsListRow, 'config' | 'stats'>) => {
    const sourceIndex = Array.isArray(item.config.source.index)
      ? item.config.source.index.join(',')
      : item.config.source.index;
    let sourceIndexId;

    try {
      const dv = (await dataViews.find(sourceIndex)).find(({ title }) => title === sourceIndex);
      if (dv !== undefined) {
        sourceIndexId = dv.id;
      } else {
        toasts.addDanger({
          title: toMountPoint(
            <>
              <FormattedMessage
                id="xpack.ml.dataframe.analyticsList.noSourceDataViewForClone"
                defaultMessage="Unable to clone the analytics job. No data view exists for index {sourceIndex}."
                values={{ sourceIndex }}
              />
              {canCreateDataView ? (
                <EuiText size="xs" color="text">
                  <FormattedMessage
                    id="xpack.ml.dataframe.analytics.cloneAction.dataViewPromptLink"
                    defaultMessage="{linkToDataViewManagement}"
                    values={{
                      linkToDataViewManagement: (
                        <EuiLink
                          href={`${basePath.get()}/app/management/kibana/dataViews/create`}
                          target="_blank"
                        >
                          <FormattedMessage
                            id="xpack.ml.dataframe.analytics.cloneAction.dataViewPromptLinkText"
                            defaultMessage="Create a data view for {sourceIndex}"
                            values={{ sourceIndex }}
                          />
                        </EuiLink>
                      ),
                    }}
                  />
                </EuiText>
              ) : null}
            </>,
            startServices
          ),
        });
      }
    } catch (e) {
      const error = extractErrorMessage(e);

      toasts.addDanger(
        i18n.translate('xpack.ml.dataframe.analyticsList.fetchSourceDataViewForCloneErrorMessage', {
          defaultMessage: 'An error occurred checking if data view {dataView} exists: {error}',
          values: { dataView: sourceIndex, error },
        })
      );
    }

    if (sourceIndexId) {
      await mlLocator?.navigate({
        sectionId: 'ml',
        appId: `analytics/data_frame_analytics/new_job?index=${encodeURIComponent(
          sourceIndexId
        )}&jobId=${item.config.id}`,
      });
    }
  };
};

interface CloneActionNameProps {
  isDisabled: boolean;
}

export const CloneActionName: FC<CloneActionNameProps> = ({ isDisabled }) => {
  if (isDisabled) {
    return (
      <EuiToolTip
        position="top"
        content={i18n.translate('xpack.ml.dataframe.analyticsList.cloneActionPermissionTooltip', {
          defaultMessage: 'You do not have permission to clone analytics jobs.',
        })}
      >
        <>{cloneActionNameText}</>
      </EuiToolTip>
    );
  }

  return <>{cloneActionNameText}</>;
};
