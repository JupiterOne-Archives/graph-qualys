import {
  createIntegrationEntity,
  Entity,
  parseTimePropertyValue,
} from '@jupiterone/integration-sdk-core';

import { was } from '../../provider/client';
import { toStringArray } from '../../util';
import {
  convertNumericSeverityToString,
  normalizeNumericSeverity,
} from '../utils';
import { ENTITY_TYPE_WEBAPP_FINDING } from './constants';
import { Description } from './types';

export function createWebAppFindingEntity({
  finding,
  desc,
}: {
  finding: was.WebAppFinding;
  desc: Description;
}): Entity {
  return createIntegrationEntity({
    entityData: {
      // source: finding,
      source: {
        uploadStatus: 'SKIPPED',
        uploadStatusReason:
          'Raw data for detection entities currently disabled',
      },
      assign: {
        _type: ENTITY_TYPE_WEBAPP_FINDING,
        _key: finding.uniqueId,
        _class: ['Finding'],

        id: String(finding.id),
        name: finding.name!,
        displayName: finding.name!,

        qid: finding.qid,
        type: finding.type,
        severity: convertNumericSeverityToString(finding.severity),
        numericSeverity: normalizeNumericSeverity(finding.severity),
        qualysSeverity: finding.severity,

        // Use found dates, same as host vuln findings
        createdOn: parseTimePropertyValue(finding.firstDetectedDate),
        updatedOn: parseTimePropertyValue(finding.lastDetectedDate),

        lastTestedOn: parseTimePropertyValue(finding.lastTestedDate),

        // Global mapping of `Application.name` in `Finding.targets`
        targets: toStringArray([finding.webApp?.name]),

        category: 'app-scan',
        status: finding.status,
        open: !finding.status || !/fixed/i.test(finding.status),

        ...desc,
      },
    },
  });
}
