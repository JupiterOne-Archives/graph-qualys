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
import {
  ENTITY_TYPE_WEBAPP_ASSESSMENT,
  ENTITY_TYPE_WEBAPP_FINDING,
} from './constants';

export function createWebAppFindingEntity(finding: was.WebAppFinding): Entity {
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
      },
    },
  });
}

export function createWebScanAssessmentEntity(
  assessment: was.WasScanReport,
): Entity {
  return createIntegrationEntity({
    entityData: {
      source: assessment,
      assign: {
        _type: ENTITY_TYPE_WEBAPP_ASSESSMENT,
        _key: assessment.TARGET.SCAN.replace(/\s+/g, '-').toLowerCase(),
        _class: ['Assessment'],
        name: assessment.TARGET.SCAN,
        createdOn: parseTimePropertyValue(
          assessment.HEADER.GENERATION_DATETIME,
        ),
        summary: assessment.TARGET.SCAN,
        securityRisk: assessment.SUMMARY.GLOBAL_SUMMARY.SECURITY_RISK,
        vulnerabilityCount: assessment.SUMMARY.GLOBAL_SUMMARY.VULNERABILITY,
        sensitiveContentCount:
          assessment.SUMMARY.GLOBAL_SUMMARY.SENSITIVE_CONTENT,
        informationGatheredCount:
          assessment.SUMMARY.GLOBAL_SUMMARY.INFORMATION_GATHERED,
        category: 'Risk Assessment',
        internal: true,
      },
    },
  });
}
