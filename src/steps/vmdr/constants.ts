import {
  generateRelationshipType,
  RelationshipClass,
  RelationshipDirection,
  StepEntityMetadata,
  StepMappedRelationshipMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';

import { ENTITY_TYPE_SERVICE_VMDR } from '../services';

export const STEP_FETCH_SCANNED_HOST_IDS = 'fetch-scanned-host-ids';
export const STEP_FETCH_SCANNED_HOST_DETAILS = 'fetch-scanned-host-details';
export const STEP_FETCH_SCANNED_HOST_FINDINGS = 'fetch-scanned-host-detections';

export const DATA_SCANNED_HOST_IDS = 'DATA_SCANNED_HOST_IDS';

/**
 * Detection target values pulled from a host asset that serve as additional
 * information for building Finding entities during host detection processing.
 */
export const DATA_HOST_ASSET_TARGETS = 'DATA_HOST_ASSET_TARGETS';

export const DATA_HOST_VULNERABILITY_FINDING_KEYS =
  'DATA_HOST_VULNERABILITY_FINDING_KEYS';

export const ENTITY_TYPE_HOST_FINDING = 'qualys_host_finding';

export const ENTITY_TYPE_DISCOVERED_HOST = 'discovered_host';
export const ENTITY_TYPE_EC2_HOST = 'aws_instance';
export const ENTITY_TYPE_GCP_HOST = 'google_compute_instance';

export const RELATIONSHIP_TYPE_SERVICE_HOST_FINDING = generateRelationshipType(
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

export const MAPPED_RELATIONSHIP_TYPE_VDMR_GCP_HOST = generateRelationshipType(
  RelationshipClass.SCANS,
  ENTITY_TYPE_SERVICE_VMDR,
  ENTITY_TYPE_GCP_HOST,
);

export const VmdrEntities: Record<string, StepEntityMetadata> = {
  HOST_FINDING: {
    _type: ENTITY_TYPE_HOST_FINDING,
    _class: 'Finding',
    resourceName: 'Host Detection',
    partial: true,
    indexMetadata: {
      enabled: true,
    },
  },
};

export const VmdrRelationships: Record<string, StepRelationshipMetadata> = {
  SERVICE_HOST_FINDING: {
    _type: RELATIONSHIP_TYPE_SERVICE_HOST_FINDING,
    _class: RelationshipClass.IDENTIFIED,
    sourceType: ENTITY_TYPE_SERVICE_VMDR,
    targetType: ENTITY_TYPE_HOST_FINDING,
    partial: true,
    indexMetadata: {
      enabled: true,
    },
  },
};

export const VmdrMappedRelationships: Record<
  string,
  StepMappedRelationshipMetadata
> = {
  SERVICE_DISCOVERED_HOST: {
    _type: MAPPED_RELATIONSHIP_TYPE_VDMR_DISCOVERED_HOST,
    _class: RelationshipClass.SCANS,
    sourceType: ENTITY_TYPE_SERVICE_VMDR,
    direction: RelationshipDirection.FORWARD,
    targetType: ENTITY_TYPE_DISCOVERED_HOST,
    partial: true,
    indexMetadata: {
      enabled: true,
    },
  },
  SERVICE_EC2_HOST: {
    _type: MAPPED_RELATIONSHIP_TYPE_VDMR_EC2_HOST,
    _class: RelationshipClass.SCANS,
    sourceType: ENTITY_TYPE_SERVICE_VMDR,
    direction: RelationshipDirection.FORWARD,
    targetType: ENTITY_TYPE_EC2_HOST,
    partial: true,
    indexMetadata: {
      enabled: true,
    },
  },
  SERVICE_GCP_HOST: {
    _type: MAPPED_RELATIONSHIP_TYPE_VDMR_GCP_HOST,
    _class: RelationshipClass.SCANS,
    sourceType: ENTITY_TYPE_SERVICE_VMDR,
    direction: RelationshipDirection.FORWARD,
    targetType: ENTITY_TYPE_GCP_HOST,
    partial: true,
    indexMetadata: {
      enabled: true,
    },
  },
};
