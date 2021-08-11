import {
  createMappedRelationship,
  generateRelationshipType,
  MappedRelationship,
  RelationshipClass,
  RelationshipDirection,
  TargetEntityProperties,
} from '@jupiterone/integration-sdk-core';

import { vmpc } from '../../provider/client';
import toArray from '../../util/toArray';
import { ENTITY_TYPE_HOST_FINDING } from '../vmdr/constants';
import {
  // ENTITY_TYPE_CVE_VULNERABILITY,
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
  findingKey: string,
  targetEntityProperties: TargetEntityProperties[],
): { relationships: MappedRelationship[]; duplicates: MappedRelationship[] } {
  const seenRelationshipKeys = new Set<string>();
  const duplicates: MappedRelationship[] = [];
  const relationships: MappedRelationship[] = [];

  for (const targetEntity of targetEntityProperties) {
    const relationship = createMappedRelationship({
      _class: RelationshipClass.IS,
      _type: generateRelationshipType(
        RelationshipClass.IS,
        ENTITY_TYPE_HOST_FINDING,
        targetEntity._type!,
      ),
      _mapping: {
        relationshipDirection: RelationshipDirection.FORWARD,
        sourceEntityKey: findingKey,
        targetFilterKeys: [['_type', '_key']],
        targetEntity,
      },
    });

    if (seenRelationshipKeys.has(relationship._key)) {
      duplicates.push(relationship);
      continue;
    }

    relationships.push(relationship);
    seenRelationshipKeys.add(relationship._key);
  }
  return { relationships, duplicates };
}

/**
 * Creates a set of mapped relationship target entities for each Vulnerability.
 *
 * When a vuln is related to one or more CVEs, the properties will map to
 * `_type: ENTITY_TYPE_CVE_VULNERABILITY, _key: '<cve id>'`. In the case where a
 * vulnerability has no CVEs, the properties will map to `_type:
 * ENTITY_TYPE_QUALYS_VULNERABILITY, _key: 'vuln-qid:<qid>'`.
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

  // We opted to comment out the CVE target entity creation and purely use
  // qualys_vuln entities. We may revisit this so I'm leaving it commented out
  // in case we want to turn this back on.

  // for (const cve of toArray(vuln.CVE_LIST?.CVE)) {
  //   if (cve.ID) {
  //     properties.push({
  //       _class: 'Vulnerability',
  //       _type: ENTITY_TYPE_CVE_VULNERABILITY,
  //       _key: cve.ID.toLowerCase(),
  //       qid: vuln.QID,
  //       id: cve.ID,
  //       name: cve.ID,
  //       displayName: cve.ID,
  //       webLink: cve.URL,
  //       cvssScore: vuln.CVSS?.BASE,
  //       cvssScoreV3: vuln.CVSS_V3?.BASE,
  //     });
  //   }
  // }

  properties.push({
    _class: 'Vulnerability',
    _type: ENTITY_TYPE_QUALYS_VULNERABILITY,
    _key: `vuln-qid:${vuln.QID}`,
    qid: vuln.QID,
    id: String(vuln.QID!),
    name: vuln.TITLE,
    displayName: vuln.TITLE,
    webLink: buildQualysGuardVulnWebLink(qualysHost, vuln.QID!),
    severityLevel: vuln.SEVERITY_LEVEL, // raw value, not normalized as it is on `Finding.numericSeverity`

    cveList: toArray(vuln.CVE_LIST?.CVE).toString(),
    cvssScore: vuln.CVSS?.BASE,
    cvssScoreV3: vuln.CVSS_V3?.BASE,

    vulnType: vuln.VULN_TYPE,
    solution: vuln.SOLUTION,
    discoveryRemote: vuln.DISCOVERY?.REMOTE,
    category: vuln.CATEGORY,
  });

  return properties;
}

function buildQualysGuardVulnWebLink(qualysHost: string, qid: number): string {
  return `https://qualysguard.${qualysHost}/fo/common/vuln_info.php?id=${qid}`;
}
