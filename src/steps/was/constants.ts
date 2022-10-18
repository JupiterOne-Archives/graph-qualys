import {
  generateRelationshipType,
  RelationshipClass,
  RelationshipDirection,
  StepEntityMetadata,
  StepMappedRelationshipMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';

import { ENTITY_TYPE_SERVICE_WAS } from '../services';

export const STEP_FETCH_SCANNED_WEBAPPS = 'fetch-scanned-webapps';
export const STEP_FETCH_SCANNED_WEBAPP_FINDINGS =
  'fetch-scanned-webapp-findings';
export const STEP_FETCH_ASSESSMENTS = 'fetch-assessments';

export const DATA_SCANNED_WEBAPP_IDS = 'DATA_SCANNED_WEBAPP_IDS';
export const DATA_WEBAPP_VULNERABILITY_FINDING_KEYS =
  'DATA_WEBAPP_VULNERABILITY_FINDING_KEYS';

export const ENTITY_TYPE_WEBAPP = 'web_app';
export const ENTITY_TYPE_WEBAPP_FINDING = 'qualys_web_app_finding';
export const ENTITY_TYPE_WEBAPP_ASSESSMENT = 'qualys_web_app_assessment';

export const RELATIONSHIP_TYPE_SERVICE_WEBAPP_FINDING = generateRelationshipType(
  RelationshipClass.IDENTIFIED,
  ENTITY_TYPE_SERVICE_WAS,
  ENTITY_TYPE_WEBAPP_FINDING,
);

export const MAPPED_RELATIONSHIP_TYPE_WAS_SCANS_WEBAPP = generateRelationshipType(
  RelationshipClass.SCANS,
  ENTITY_TYPE_SERVICE_WAS,
  ENTITY_TYPE_WEBAPP,
);

export const MAPPED_RELATIONSHIP_TYPE_WEBAPP_HAS_FINDING = generateRelationshipType(
  RelationshipClass.HAS,
  ENTITY_TYPE_WEBAPP,
  ENTITY_TYPE_WEBAPP_FINDING,
);

export const MAPPED_RELATIONSHIP_TYPE_WEBAPP_HAS_ASSESSMENT = generateRelationshipType(
  RelationshipClass.HAS,
  ENTITY_TYPE_WEBAPP,
  ENTITY_TYPE_WEBAPP_ASSESSMENT,
);

export const WasEntities: Record<string, StepEntityMetadata> = {
  WEBAPP_FINDING: {
    _type: ENTITY_TYPE_WEBAPP_FINDING,
    _class: 'Finding',
    resourceName: 'Web App Finding',
    partial: true,
    indexMetadata: {
      enabled: false,
    },
  },
  WEBAPP_ASSESSMENT: {
    _type: ENTITY_TYPE_WEBAPP_ASSESSMENT,
    _class: 'Assessment',
    resourceName: 'Web App Assessment',
    partial: true,
    indexMetadata: {
      enabled: false,
    },
  },
};

export const WasRelationships: Record<string, StepRelationshipMetadata> = {
  SERVICE_WEBAPP_FINDING: {
    _type: RELATIONSHIP_TYPE_SERVICE_WEBAPP_FINDING,
    _class: RelationshipClass.IDENTIFIED,
    sourceType: ENTITY_TYPE_SERVICE_WAS,
    targetType: ENTITY_TYPE_WEBAPP_FINDING,
    partial: true,
    indexMetadata: {
      enabled: false,
    },
  },
};

export const WasMappedRelationships: Record<
  string,
  StepMappedRelationshipMetadata
> = {
  SERVICE_SCANS_WEBAPP: {
    _type: MAPPED_RELATIONSHIP_TYPE_WAS_SCANS_WEBAPP,
    _class: RelationshipClass.SCANS,
    sourceType: ENTITY_TYPE_SERVICE_WAS,
    targetType: ENTITY_TYPE_WEBAPP,
    partial: true,
    direction: RelationshipDirection.FORWARD,
    indexMetadata: {
      enabled: false,
    },
  },
  WEBAPP_HAS_FINDING: {
    _type: MAPPED_RELATIONSHIP_TYPE_WEBAPP_HAS_FINDING,
    _class: RelationshipClass.HAS,
    sourceType: ENTITY_TYPE_WEBAPP,
    targetType: ENTITY_TYPE_WEBAPP_FINDING,
    partial: true,
    direction: RelationshipDirection.FORWARD,
    indexMetadata: {
      enabled: false,
    },
  },
  WEBAPP_HAS_ASSESSMENT: {
    _type: MAPPED_RELATIONSHIP_TYPE_WEBAPP_HAS_ASSESSMENT,
    _class: RelationshipClass.HAS,
    sourceType: ENTITY_TYPE_WEBAPP,
    targetType: ENTITY_TYPE_WEBAPP_ASSESSMENT,
    partial: true,
    direction: RelationshipDirection.FORWARD,
    indexMetadata: {
      enabled: false,
    },
  },
};
