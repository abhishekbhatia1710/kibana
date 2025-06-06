/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EuiBasicTableColumn } from '@elastic/eui';
import {
  EuiBadge,
  EuiButtonEmpty,
  EuiLink,
  EuiLoadingSpinner,
  EuiText,
  EuiToolTip,
} from '@elastic/eui';
import React, { useMemo } from 'react';
import { ThreeWayDiffConflict } from '../../../../../../common/api/detection_engine';
import type { RuleUpgradeState } from '../../../../rule_management/model/prebuilt_rule_upgrade/rule_upgrade_state';
import { RulesTableEmptyColumnName } from '../rules_table_empty_column_name';
import { SHOW_RELATED_INTEGRATIONS_SETTING } from '../../../../../../common/constants';
import type { RuleSignatureId } from '../../../../../../common/api/detection_engine/model/rule_schema';
import { PopoverItems } from '../../../../../common/components/popover_items';
import { useUiSetting$ } from '../../../../../common/lib/kibana';
import { hasUserCRUDPermission } from '../../../../../common/utils/privileges';
import { IntegrationsPopover } from '../../../../common/components/related_integrations/integrations_popover';
import { SeverityBadge } from '../../../../../common/components/severity_badge';
import { useUserData } from '../../../../../detections/components/user_info';
import * as i18n from '../../../../common/translations';
import type { Rule } from '../../../../rule_management/logic';
import { getNormalizedSeverity } from '../helpers';
import type { UpgradePrebuiltRulesTableActions } from './upgrade_prebuilt_rules_table_context';
import { useUpgradePrebuiltRulesTableContext } from './upgrade_prebuilt_rules_table_context';
import { usePrebuiltRulesCustomizationStatus } from '../../../../rule_management/logic/prebuilt_rules/use_prebuilt_rules_customization_status';

export type TableColumn = EuiBasicTableColumn<RuleUpgradeState>;

interface RuleNameProps {
  name: string;
  ruleId: string;
}

const RuleName = ({ name, ruleId }: RuleNameProps) => {
  const {
    actions: { openRulePreview },
  } = useUpgradePrebuiltRulesTableContext();

  return (
    <EuiLink
      onClick={() => {
        openRulePreview(ruleId);
      }}
      data-test-subj="ruleName"
    >
      {name}
    </EuiLink>
  );
};

const RULE_NAME_COLUMN: TableColumn = {
  field: 'current_rule.name',
  name: i18n.COLUMN_RULE,
  render: (value: RuleUpgradeState['current_rule']['name'], ruleUpgradeState: RuleUpgradeState) => (
    <RuleName name={value} ruleId={ruleUpgradeState.rule_id} />
  ),
  sortable: true,
  truncateText: true,
  width: '60%',
  align: 'left',
};

const TAGS_COLUMN: TableColumn = {
  field: 'current_rule.tags',
  name: <RulesTableEmptyColumnName name={i18n.COLUMN_TAGS} />,
  align: 'center',
  render: (tags: Rule['tags']) => {
    if (tags == null || tags.length === 0) {
      return null;
    }

    const renderItem = (tag: string, i: number) => (
      <EuiBadge color="hollow" key={`${tag}-${i}`} data-test-subj="tag">
        {tag}
      </EuiBadge>
    );
    return (
      <PopoverItems
        items={tags}
        popoverTitle={i18n.COLUMN_TAGS}
        popoverButtonTitle={tags.length.toString()}
        popoverButtonIcon="tag"
        dataTestPrefix="tags"
        renderItem={renderItem}
      />
    );
  },
  width: '65px',
  truncateText: true,
};

const INTEGRATIONS_COLUMN: TableColumn = {
  field: 'current_rule.related_integrations',
  name: <RulesTableEmptyColumnName name={i18n.COLUMN_INTEGRATIONS} />,
  align: 'center',
  render: (integrations: Rule['related_integrations']) => {
    if (integrations == null || integrations.length === 0) {
      return null;
    }

    return <IntegrationsPopover relatedIntegrations={integrations} />;
  },
  width: '70px',
  truncateText: true,
};

const MODIFIED_COLUMN: TableColumn = {
  field: 'current_rule.rule_source',
  name: <RulesTableEmptyColumnName name={i18n.COLUMN_MODIFIED} />,
  align: 'center',
  render: (ruleSource: Rule['rule_source']) => {
    if (
      ruleSource == null ||
      ruleSource.type === 'internal' ||
      (ruleSource.type === 'external' && ruleSource.is_customized === false)
    ) {
      return null;
    }

    return (
      <EuiToolTip content={i18n.MODIFIED_TOOLTIP}>
        <EuiBadge
          color="hollow"
          data-test-subj="upgradeRulesTableModifiedColumnBadge"
          aria-label={i18n.MODIFIED_LABEL}
        >
          {i18n.MODIFIED_LABEL}
        </EuiBadge>
      </EuiToolTip>
    );
  },
  width: '90px',
  truncateText: true,
};

const CONFLICT_COLUMN: TableColumn = {
  field: 'conflict',
  name: <RulesTableEmptyColumnName name={i18n.COLUMN_CONFLICT} />,
  align: 'center',
  render: (conflict: ThreeWayDiffConflict) => {
    switch (conflict) {
      case ThreeWayDiffConflict.SOLVABLE:
        return (
          <EuiToolTip content={i18n.SOLVABLE_CONFLICT_TOOLTIP}>
            <EuiBadge
              color="warning"
              data-test-subj="upgradeRulesTableSolvableConflictColumnBadge"
              aria-label={i18n.SOLVABLE_CONFLICT_LABEL}
            >
              {i18n.SOLVABLE_CONFLICT_LABEL}
            </EuiBadge>
          </EuiToolTip>
        );

      case ThreeWayDiffConflict.NON_SOLVABLE:
        return (
          <EuiToolTip content={i18n.NON_SOLVABLE_CONFLICT_TOOLTIP}>
            <EuiBadge
              color="danger"
              data-test-subj="upgradeRulesTableUnsolvableConflictColumnBadge"
              aria-label={i18n.NON_SOLVABLE_CONFLICT_LABEL}
            >
              {i18n.NON_SOLVABLE_CONFLICT_LABEL}
            </EuiBadge>
          </EuiToolTip>
        );
    }
  },
  width: '170px',
  truncateText: true,
};

const createUpgradeButtonColumn = (
  upgradeRules: UpgradePrebuiltRulesTableActions['upgradeRules'],
  openRulePreview: UpgradePrebuiltRulesTableActions['openRulePreview'],
  loadingRules: RuleSignatureId[],
  isDisabled: boolean,
  isPrebuiltRulesCustomizationEnabled: boolean
): TableColumn => ({
  field: 'rule_id',
  name: <RulesTableEmptyColumnName name={i18n.UPDATE_RULE_BUTTON} />,
  render: (ruleId: RuleSignatureId, record) => {
    const isRuleUpgrading = loadingRules.includes(ruleId);
    const isDisabledByConflicts =
      isPrebuiltRulesCustomizationEnabled && record.hasUnresolvedConflicts;
    const isUpgradeButtonDisabled = isRuleUpgrading || isDisabled;
    const spinner = (
      <EuiLoadingSpinner
        size="s"
        data-test-subj={`upgradeSinglePrebuiltRuleButton-loadingSpinner-${ruleId}`}
      />
    );

    if (isDisabledByConflicts) {
      return (
        <EuiToolTip content={i18n.UPDATE_RULE_BUTTON_TOOLTIP_CONFLICTS}>
          <EuiButtonEmpty
            color="warning"
            size="s"
            disabled={isUpgradeButtonDisabled}
            onClick={() => openRulePreview(ruleId)}
            data-test-subj={`reviewSinglePrebuiltRuleButton-${ruleId}`}
          >
            {isRuleUpgrading ? spinner : i18n.REVIEW_RULE_BUTTON}
          </EuiButtonEmpty>
        </EuiToolTip>
      );
    }

    return (
      <EuiButtonEmpty
        size="s"
        disabled={isUpgradeButtonDisabled}
        onClick={() => upgradeRules([ruleId])}
        data-test-subj={`upgradeSinglePrebuiltRuleButton-${ruleId}`}
      >
        {isRuleUpgrading ? spinner : i18n.UPDATE_RULE_BUTTON}
      </EuiButtonEmpty>
    );
  },
  width: '10%',
  align: 'center',
});

export const useUpgradePrebuiltRulesTableColumns = (): TableColumn[] => {
  const [{ canUserCRUD }] = useUserData();
  const hasCRUDPermissions = hasUserCRUDPermission(canUserCRUD);
  const [showRelatedIntegrations] = useUiSetting$<boolean>(SHOW_RELATED_INTEGRATIONS_SETTING);
  const {
    state: { loadingRules, isRefetching, isUpgradingSecurityPackages },
    actions: { upgradeRules, openRulePreview },
  } = useUpgradePrebuiltRulesTableContext();
  const isDisabled = isRefetching || isUpgradingSecurityPackages;
  const { isRulesCustomizationEnabled } = usePrebuiltRulesCustomizationStatus();

  return useMemo(
    () => [
      RULE_NAME_COLUMN,
      MODIFIED_COLUMN,
      ...(isRulesCustomizationEnabled ? [CONFLICT_COLUMN] : []),
      ...(showRelatedIntegrations ? [INTEGRATIONS_COLUMN] : []),
      TAGS_COLUMN,
      {
        field: 'current_rule.risk_score',
        name: i18n.COLUMN_RISK_SCORE,
        render: (value: Rule['risk_score']) => (
          <EuiText data-test-subj="riskScore" size="s">
            {value}
          </EuiText>
        ),
        sortable: true,
        truncateText: true,
        width: '85px',
      },
      {
        field: 'current_rule.severity',
        name: i18n.COLUMN_SEVERITY,
        render: (value: Rule['severity']) => <SeverityBadge value={value} />,
        sortable: ({ current_rule: { severity } }: RuleUpgradeState) =>
          getNormalizedSeverity(severity),
        truncateText: true,
        width: '10%',
      },
      ...(hasCRUDPermissions
        ? [
            createUpgradeButtonColumn(
              upgradeRules,
              openRulePreview,
              loadingRules,
              isDisabled,
              isRulesCustomizationEnabled
            ),
          ]
        : []),
    ],
    [
      showRelatedIntegrations,
      hasCRUDPermissions,
      upgradeRules,
      openRulePreview,
      loadingRules,
      isDisabled,
      isRulesCustomizationEnabled,
    ]
  );
};
