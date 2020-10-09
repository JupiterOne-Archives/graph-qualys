import {
  createMappedRelationship,
  Entity,
  generateRelationshipType,
  MappedRelationship,
  RelationshipClass,
  RelationshipDirection,
  TargetEntityProperties,
} from '@jupiterone/integration-sdk-core';

import { vmpc } from '../../provider/client';
import toArray from '../../util/toArray';
import {
  ENTITY_TYPE_CVE_VULNERABILITY,
  ENTITY_TYPE_QUALYS_VULNERABILITY,
} from './constants';

/**
 * Creates N mapped relationships, one for each `TargetEntityProperties`
 * provided.
 *
 * @param findingEntity the Entity representing the host detection Finding
 * @param targetEntityProperties an Array of `TargetEntityProperties`
 * representing each vulnerability associated with the Finding
 */
export function createFindingVulnerabilityMappedRelationships(
  findingEntity: Entity,
  targetEntityProperties: TargetEntityProperties[],
): MappedRelationship[] {
  return targetEntityProperties.map((targetEntity) =>
    createMappedRelationship({
      _class: RelationshipClass.IS,
      _type: generateRelationshipType(
        RelationshipClass.IS,
        findingEntity._type,
        targetEntity._type!,
      ),
      _mapping: {
        relationshipDirection: RelationshipDirection.FORWARD,
        sourceEntityKey: findingEntity._key,
        targetFilterKeys: [['_type', '_key']],
        targetEntity,
      },
    }),
  );
}

/**
 * Creates a set of mapped relationship target entities for each Vulnerability.
 *
 * When a vuln is related to one or more CVEs, the properties will map to
 * `_type: ENTITY_TYPE_CVE_VULNERABILITY, _key: '<cve id>'`. In the case where a
 * vulnerability has no CVEs, the properties will map to `_type:
 * ENTITY_TYPE_QUALYS_VULNERABILITY, _key: 'qualys-vuln-<qid>'`.
 *
 * @param qualysHost the host name of the Qualys server, i.e.
 * qg3.apps.qualys.com, to be used in building `webLink` values to the Qualys UI
 * @param vuln the vulnerability data from the Qualys Knowledgebase
 */
export function createVulnerabilityTargetEntities(
  qualysHost: string,
  vuln: vmpc.Vuln,
): TargetEntityProperties[] {
  const properties: TargetEntityProperties[] = [];

  for (const cve of toArray(vuln.CVE_LIST?.CVE)) {
    if (cve.ID) {
      properties.push({
        _class: 'Vulnerability',
        _type: ENTITY_TYPE_CVE_VULNERABILITY,
        _key: cve.ID.toLowerCase(),
        id: cve.ID,
        name: cve.ID,
        displayName: cve.ID,
        webLink: cve.URL,
        cvssScore: vuln.CVSS?.BASE,
        cvssScoreV3: vuln.CVSS_V3?.BASE,
      });
    }
  }

  if (properties.length === 0) {
    properties.push({
      _class: 'Vulnerability',
      _type: ENTITY_TYPE_QUALYS_VULNERABILITY,
      _key: `vuln-qid:${vuln.QID}`,
      id: String(vuln.QID!),
      name: vuln.TITLE,
      displayName: vuln.TITLE,
      webLink: buildQualysGuardVulnWebLink(qualysHost, vuln.QID!),
      severityLevel: vuln.SEVERITY_LEVEL, // raw value, not normalized as it is on `Finding.numericSeverity`
    });
  }

  return properties;
}

function buildQualysGuardVulnWebLink(qualysHost: string, qid: number): string {
  return `https://qualysguard.${qualysHost}/fo/common/vuln_info.php?id=${qid}`;
}
