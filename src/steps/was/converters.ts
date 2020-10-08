import {
  convertProperties,
  createIntegrationEntity,
  Entity,
  parseTimePropertyValue,
} from '@jupiterone/integration-sdk-core';

import { was } from '../../provider/client';
import { ENTITY_TYPE_WEBAPP_FINDING } from './constants';

export function createWebAppFindingEntity(finding: was.WebAppFinding): Entity {
  return createIntegrationEntity({
    entityData: {
      source: finding,
      assign: {
        ...convertProperties(finding),

        _type: ENTITY_TYPE_WEBAPP_FINDING,
        _key: finding.uniqueId,
        _class: 'Finding',

        id: String(finding.id),
        name: finding.name!,
        displayName: finding.name!,

        qid: finding.qid,
        type: finding.type,
        severity: finding.severity,
        // TODO: convert string severty to numeric
        // numericSeverity: finding.severity,

        // Use found dates, same as host vuln findings
        createdOn: parseTimePropertyValue(finding.firstDetectedDate),
        updatedOn: parseTimePropertyValue(finding.lastDetectedDate),

        lastTestedOn: parseTimePropertyValue(finding.lastTestedDate),

        // Global mapping of `Application.name` in `Finding.targets`
        targets: finding.webApp?.name,
      },
    },
  });
}
