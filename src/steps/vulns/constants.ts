import {
  generateRelationshipType,
  RelationshipClass,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';

import { ENTITY_TYPE_HOST_FINDING } from '../vmdr/constants';
import { ENTITY_TYPE_WEBAPP_FINDING } from '../was/constants';

export const STEP_FETCH_FINDING_VULNS = 'fetch-finding-vulns';

/**
 * The _type of Vulnerability when CVE is known.
 */
export const ENTITY_TYPE_CVE_VULNERABILITY = 'cve';

/**
 * The _type of Vulnerability when there are no related CVEs.
 */
export const ENTITY_TYPE_QUALYS_VULNERABILITY = 'qualys_vuln';

export const MAPPED_RELATIONSHIP_TYPE_HOST_FINDING_CVE_VULNERABILITY = generateRelationshipType(
  RelationshipClass.IS,
  ENTITY_TYPE_HOST_FINDING,
  ENTITY_TYPE_CVE_VULNERABILITY,
);
export const MAPPED_RELATIONSHIP_TYPE_HOST_FINDING_QUALYS_VULNERABILITY = generateRelationshipType(
  RelationshipClass.IS,
  ENTITY_TYPE_HOST_FINDING,
  ENTITY_TYPE_QUALYS_VULNERABILITY,
);
export const MAPPED_RELATIONSHIP_TYPE_WEBAPP_FINDING_CVE_VULNERABILITY = generateRelationshipType(
  RelationshipClass.IS,
  ENTITY_TYPE_WEBAPP_FINDING,
  ENTITY_TYPE_CVE_VULNERABILITY,
);
export const MAPPED_RELATIONSHIP_TYPE_WEBAPP_FINDING_QUALYS_VULNERABILITY = generateRelationshipType(
  RelationshipClass.IS,
  ENTITY_TYPE_WEBAPP_FINDING,
  ENTITY_TYPE_QUALYS_VULNERABILITY,
);

export const VulnRelationships: Record<string, StepRelationshipMetadata> = {
  HOST_FINDING_QUALYS_VULN: {
    _type: MAPPED_RELATIONSHIP_TYPE_HOST_FINDING_QUALYS_VULNERABILITY,
    _class: RelationshipClass.IS,
    sourceType: ENTITY_TYPE_HOST_FINDING,
    targetType: ENTITY_TYPE_QUALYS_VULNERABILITY,
    partial: true,
    indexMetadata: {
      enabled: true,
    },
  },
  HOST_FINDING_CVE_VULN: {
    _type: MAPPED_RELATIONSHIP_TYPE_HOST_FINDING_CVE_VULNERABILITY,
    _class: RelationshipClass.IS,
    sourceType: ENTITY_TYPE_HOST_FINDING,
    targetType: ENTITY_TYPE_CVE_VULNERABILITY,
    partial: true,
    indexMetadata: {
      enabled: true,
    },
  },
  WEBAPP_FINDING_QUALYS_VULN: {
    _type: MAPPED_RELATIONSHIP_TYPE_WEBAPP_FINDING_QUALYS_VULNERABILITY,
    _class: RelationshipClass.IS,
    sourceType: ENTITY_TYPE_WEBAPP_FINDING,
    targetType: ENTITY_TYPE_QUALYS_VULNERABILITY,
    partial: true,
    indexMetadata: {
      enabled: true,
    },
  },
  WEBAPP_FINDING_CVE_VULN: {
    _type: MAPPED_RELATIONSHIP_TYPE_WEBAPP_FINDING_CVE_VULNERABILITY,
    _class: RelationshipClass.IS,
    sourceType: ENTITY_TYPE_WEBAPP_FINDING,
    targetType: ENTITY_TYPE_CVE_VULNERABILITY,
    partial: true,
    indexMetadata: {
      enabled: true,
    },
  },
};
