/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  settingsObjectType,
  settingsObjectId,
} from '@kbn/uptime-plugin/server/legacy_uptime/lib/saved_objects/uptime_settings';
import { FtrProviderContext } from '../../ftr_provider_context';

export function UptimeCommonProvider({ getService, getPageObjects }: FtrProviderContext) {
  const testSubjects = getService('testSubjects');
  const server = getService('kibanaServer');
  const browser = getService('browser');
  const retry = getService('retry');
  const find = getService('find');

  const { header } = getPageObjects(['header']);

  return {
    async assertExists(key: string) {
      if (!(await testSubjects.exists(key))) {
        throw new Error(`Couldn't find expected element with key "${key}".`);
      }
    },
    async monitorIdExists(key: string) {
      await retry.tryForTime(10000, async () => {
        await testSubjects.existOrFail(key);
      });
    },
    async monitorPageLinkExists(monitorId: string) {
      await testSubjects.existOrFail(`monitor-page-link-${monitorId}`);
    },
    async urlContains(expected: string) {
      const url = await browser.getCurrentUrl();
      return url.indexOf(expected) >= 0;
    },
    async pageHasDataMissing() {
      return await testSubjects.find('data-missing', 5000);
    },
    async setKueryBarText(attribute: string, value: string) {
      await testSubjects.click(attribute);
      await testSubjects.setValue(attribute, value);
      await browser.pressKeys(browser.keys.ENTER);
    },
    async setFilterText(filterQuery: string) {
      await this.setKueryBarText('queryInput', filterQuery);
    },
    async goToNextPage() {
      await testSubjects.click('xpack.uptime.monitorList.nextButton', 5000);
    },
    async goToPreviousPage() {
      await testSubjects.click('xpack.synthetics.monitorList.prevButton', 5000);
    },
    async setStatusFilterUp() {
      await testSubjects.click('xpack.synthetics.filterBar.filterStatusUp');
    },
    async setStatusFilterDown() {
      await testSubjects.click('xpack.synthetics.filterBar.filterStatusDown');
    },
    async resetStatusFilter() {
      const upFilter = await find.byCssSelector(
        '[data-test-subj="xpack.synthetics.filterBar.filterStatusUp"]'
      );
      if (await upFilter.elementHasClass('euiFilterButton-hasActiveFilters')) {
        await this.setStatusFilterUp();
      }
      const downFilter = await find.byCssSelector(
        '[data-test-subj="xpack.synthetics.filterBar.filterStatusDown"]'
      );
      if (await downFilter.elementHasClass('euiFilterButton-hasActiveFilters')) {
        await this.setStatusFilterDown();
      }
    },
    async selectFilterItem(filterType: string, itemArg: string | string[]) {
      const itemList = Array.isArray(itemArg) ? itemArg : [itemArg];
      const filterPopoverButton = await find.byCssSelector(
        `[aria-label="expands filter group for ${filterType} filter"]`
      );
      await filterPopoverButton.click();
      await this.clickFilterItems(itemList);
      return this.applyFilterItems(filterType);
    },
    async clickFilterItems(itemList: string[]) {
      for (const title of itemList) {
        await find.clickByCssSelector(`li[title="${title}"]`);
      }
    },
    async applyFilterItems(filterType: string) {
      const applyButton = await find.byCssSelector(
        `[aria-label="Apply the selected filters for ${filterType}"]`
      );
      await applyButton.click();
    },
    async getSnapshotCount() {
      return {
        up: await testSubjects.getVisibleText('xpack.synthetics.snapshot.donutChart.up'),
        down: await testSubjects.getVisibleText('xpack.synthetics.snapshot.donutChart.down'),
      };
    },
    async openPageSizeSelectPopover(): Promise<void> {
      return testSubjects.click('xpack.uptime.monitorList.pageSizeSelect.popoverOpen', 5000);
    },
    async clickPageSizeSelectPopoverItem(size: number = 10): Promise<void> {
      return testSubjects.click(
        `xpack.uptime.monitorList.pageSizeSelect.sizeSelectItem${size.toString()}`,
        5000
      );
    },
    async waitUntilDataIsLoaded() {
      await header.waitUntilLoadingHasFinished();
      return retry.tryForTime(60 * 1000, async () => {
        if (await testSubjects.exists('data-missing')) {
          await browser.refresh();
          await header.waitUntilLoadingHasFinished();
        }
        await testSubjects.missingOrFail('data-missing');
      });
    },
    async hasMappingsError() {
      return testSubjects.exists('xpack.synthetics.mappingsErrorPage');
    },

    async deleteUptimeSettingsObject() {
      // delete the saved object
      try {
        await server.savedObjects.delete({
          type: settingsObjectType,
          id: settingsObjectId,
        });
      } catch (e) {
        // a 404 just means the doc is already missing
        if (e.response.status !== 404) {
          const { status, statusText, data, headers, config } = e.response;
          throw new Error(
            `error attempting to delete settings:\n${JSON.stringify(
              { status, statusText, data, headers, config },
              null,
              2
            )}`
          );
        }
      }
    },
  };
}
