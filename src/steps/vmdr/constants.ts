import {
  generateRelationshipType,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { ENTITY_TYPE_SERVICE_VMDR } from '../services';

// Step IDs
export const STEP_FETCH_SCANNED_HOST_IDS = 'fetch-scanned-host-ids';
export const STEP_FETCH_SCANNED_HOST_DETAILS = 'fetch-scanned-host-details';
export const STEP_FETCH_SCANNED_HOST_FINDINGS = 'fetch-scanned-host-detections';

// Inter-step data storage keys
export const DATA_SCANNED_HOST_IDS = 'DATA_SCANNED_HOST_IDS';
export const DATA_HOST_TARGETS = 'DATA_HOST_TARGETS';
export const DATA_VULNERABILITY_FINDING_KEYS =
  'DATA_VULNERABILITY_FINDING_KEYS';

export const ENTITY_TYPE_HOST_FINDING = 'qualys_host_finding';

export const ENTITY_TYPE_DISCOVERED_HOST = 'discovered_host';
export const ENTITY_TYPE_EC2_HOST = 'aws_instance';

export const RELATIONSHIP_TYPE_SERVICE_FINDING = generateRelationshipType(
  RelationshipClass.IDENTIFIED,
  ENTITY_TYPE_SERVICE_VMDR,
  ENTITY_TYPE_HOST_FINDING,
);

export const MAPPED_RELATIONSHIP_TYPE_VDMR_DISCOVERED_HOST = generateRelationshipType(
  RelationshipClass.SCANS,
  ENTITY_TYPE_SERVICE_VMDR,
  ENTITY_TYPE_DISCOVERED_HOST,
);
export const MAPPED_RELATIONSHIP_TYPE_VDMR_EC2_HOST = generateRelationshipType(
  RelationshipClass.SCANS,
  ENTITY_TYPE_SERVICE_VMDR,
  ENTITY_TYPE_EC2_HOST,
);

export const VmdrEntities = {
  HOST_FINDING: {
    _type: ENTITY_TYPE_HOST_FINDING,
    _class: 'Finding',
    resourceName: 'Detection',
  },
};

export const VmdrRelationships = {
  SERVICE_FINDING: {
    _type: RELATIONSHIP_TYPE_SERVICE_FINDING,
    _class: RelationshipClass.IDENTIFIED,
    sourceType: ENTITY_TYPE_SERVICE_VMDR,
    targetType: ENTITY_TYPE_HOST_FINDING,
  },
  SERVICE_DISCOVERED_HOST: {
    _type: MAPPED_RELATIONSHIP_TYPE_VDMR_DISCOVERED_HOST,
    _class: RelationshipClass.SCANS,
    sourceType: ENTITY_TYPE_SERVICE_VMDR,
    targetType: ENTITY_TYPE_DISCOVERED_HOST,
  },
  SERVICE_EC2_HOST: {
    _type: MAPPED_RELATIONSHIP_TYPE_VDMR_EC2_HOST,
    _class: RelationshipClass.SCANS,
    sourceType: ENTITY_TYPE_SERVICE_VMDR,
    targetType: ENTITY_TYPE_EC2_HOST,
  },
};
