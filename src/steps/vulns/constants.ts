import {
  generateRelationshipType,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { ENTITY_TYPE_HOST_FINDING } from '../vmdr/constants';

export const STEP_FETCH_SCANNED_HOST_VULNS = 'fetch-scanned-host-vulns';

/**
 * The _type of Vulnerability when CVE is known.
 */
export const ENTITY_TYPE_CVE_VULNERABILITY = 'cve';

/**
 * The _type of Vulnerability when there are no related CVEs.
 */
export const ENTITY_TYPE_QUALYS_VULNERABILITY = 'qualys_vuln';

export const MAPPED_RELATIONSHIP_TYPE_FINDING_CVE_VULNERABILITY = generateRelationshipType(
  RelationshipClass.IS,
  ENTITY_TYPE_HOST_FINDING,
  ENTITY_TYPE_CVE_VULNERABILITY,
);
export const MAPPED_RELATIONSHIP_TYPE_FINDING_QUALYS_VULNERABILITY = generateRelationshipType(
  RelationshipClass.IS,
  ENTITY_TYPE_HOST_FINDING,
  ENTITY_TYPE_QUALYS_VULNERABILITY,
);

export const VulnRelationships = {
  FINDING_QUALYS_VULN: {
    _type: MAPPED_RELATIONSHIP_TYPE_FINDING_QUALYS_VULNERABILITY,
    _class: RelationshipClass.IS,
    sourceType: ENTITY_TYPE_HOST_FINDING,
    targetType: ENTITY_TYPE_QUALYS_VULNERABILITY,
  },
  FINDING_CVE_VULN: {
    _type: MAPPED_RELATIONSHIP_TYPE_FINDING_CVE_VULNERABILITY,
    _class: RelationshipClass.IS,
    sourceType: ENTITY_TYPE_HOST_FINDING,
    targetType: ENTITY_TYPE_CVE_VULNERABILITY,
  },
};
