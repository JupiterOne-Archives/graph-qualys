import { IntegrationInstanceConfigFieldMap } from '@jupiterone/integration-sdk-core';

import { UserIntegrationConfig } from './types';

const instanceConfigFields: IntegrationInstanceConfigFieldMap<UserIntegrationConfig> = {
  qualysUsername: {
    type: 'string',
  },
  qualysPassword: {
    type: 'string',
    mask: true,
  },
  qualysApiUrl: {
    type: 'string',
  },

  // TODO: Support multiselect, default selections, no selection
  // TODO: Use field definitions from open source projects to remove duplication

  /**
   * Adds finding request filter parameter `"type"`.
   *
   * Uncommenting this setting will have no effect without code changes; it's
   * here for documenation.
   */
  // wasFindingTypes: {
  //   type: 'string',
  //   // options: ['VULNERABILITY', 'SENSITIVE_CONTENT', 'INFORMATION_GATHERED']
  // },

  /**
   * Adds finding request filter parameter `"severity level"`.
   *
   * Uncommenting this setting will have no effect without code changes; it's
   * here for documenation.
   */
  // wasFindingSeverityLevels: {
  //   type: 'string',
  //   // options: [1,2,3,4,5],
  //   // defaultValue: [3,4,5]
  // },

  /**
   * Processes findings in response having the selected values, otherwise
   * findings with `isIgnored` are skipped.
   *
   * Uncommenting this setting will have no effect without code changes; it's
   * here for documenation.
   *
   * TODO: Skip findings that are `isIgnored`, later handle these values
   */
  // wasIgnoredReasons: {
  //   type: 'string',
  //   // options: ['FALSE_POSITIVE', 'RISK_ACCEPTED', 'NOT_APPLICABLE']
  //   // defaultValue: []
  // },

  /**
   * Adds host detections request filter parameter `"severities"`.
   */
  vmdrFindingSeverities: {
    // TODO: Add support for `number[]`. Will come in as a `string[]` when
    // executing in JupiterOne and a `string` in local execution (from `.env`
    // file). See https://github.com/JupiterOne/sdk/issues/462
    type: 'string',
    // options: [1,2,3,4,5]
    // defaultValue: [3,4,5]
  },

  /**
   * The integration runs with the default behavior of the detections endpoint,
   * which excludes status = 'Fixed' detections. These will be soft-deleted from
   * the graph.
   *
   * * New - The first time a vulnerability is detected by a scan the status is
   *   set to New.
   * * Active - A vulnerability detected by two or more scans is set to Active.
   * * Fixed - A vulnerability was verified by the most recent scan as fixed,
   *   and this vulnerability was detected by the previous scan.
   * * Re-Opened - A vulnerability was reopened by the most recent scan, and
   *   this vulnerability was verified as fixed by the previous scan. The next
   *   time the vulnerability is detected by a scan, the status is set to
   *   Active.
   *
   * Uncommenting this setting will have no effect without code changes; it's
   * here for documenation.
   */
  // vmdrFindingStatuses: {
  //   type:'string',
  //   options: ['New', 'Active', 'Re-Opened', 'Fixed'],
  //   defaultValue: ['New', 'Active', 'Re-Opened']
  // },

  /**
   * Processes host detections in responses having the selected values, otherwise
   * detections are skipped.
   */
  vmdrFindingTypes: {
    type: 'string',
    // options: ['Info', 'Potential', 'Confirmed'],
    // defaultValue: ['Potential', 'Confirmed'],
  },

  /**
   * Enables fetching of detection results data and transfers a limited number
   * of bytes into Finding entities. Some users would like to see some amount of
   * this information to help triage Findings.
   *
   * This is optional and it will come at a significant processing cost due to
   * the number of additional bytes transferred for all host detections.
   */
  vmdrFindingResultQids: {
    // TODO: Add support for `number[]`. Will come in as a `string[]` when
    // executing in JupiterOne and a `string` in local execution (from `.env`
    // file). See https://github.com/JupiterOne/sdk/issues/462
    type: 'string',
    // defaultValue: []
  },

  /**
   * Host detections that have been ignored are excluded by default in the
   * Qualys detections API. Obtaining them requires `include_ignored=1`.
   *
   * Uncommenting this setting will have no effect without code changes; it's
   * here for documenation.
   */
  // vmdrFindingIngored: {
  //   type: 'boolean',
  //   defaultValue: false
  // }

  /**
   * Adds scanned hosts request filter parameter `"vm_scan_since"` by
   * calculating the time since the current execution start time.
   *
   * Adds scanned web apps request filter parameter `"lastScan.date"` by
   * calculating the time since the current execution start time.
   *
   * TODO: The integration should store the time since it began ingesting this
   * data so that if this setting is changed, it can determine that it must go
   * back further to satisfy the request.
   */
  minScannedSinceDays: {
    type: 'string',
    // defaultValue: DEFAULT_SCANNED_SINCE_DAYS
  },

  // TODO Add support for virtual fields
  // minScannedSinceISODate: {
  //   type: 'string',
  //   // virtual: true,
  // },

  /**
   * Adds host detections request filter parameter `"detection_updated_since"`
   * by calculating the time since the current execution start time.
   *
   * Adds web app findings request filter parameter `"lastDetectedDate"` by
   * calculating the time since the current execution start time.
   *
   * TODO: The integration should store the time since it began ingesting this
   * data so that if this setting is changed, it can determine that it must go
   * back further to satisfy the request.
   */
  minFindingsSinceDays: {
    type: 'string',
    // defaultValue: DEFAULT_FINDINGS_SINCE_DAYS
  },

  ingestWebAppScans: {
    type: 'boolean',
  },

  // TODO Add support for virtual fields
  // minFindingsSinceISODate: {
  //   type: 'string',
  //   // virtual: true,
  // },

  webAppScanApplicationIDFilter: {
    type: 'string',
  },
  includeOnlyDetectionTags: {
    type: 'string',
  },
};

export default instanceConfigFields;
