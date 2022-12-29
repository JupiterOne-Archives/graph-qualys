import {
  createDirectRelationship,
  createIntegrationEntity,
  Entity,
  generateRelationshipType,
  IntegrationStep,
  IntegrationStepExecutionContext,
  JobState,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { createQualysAPIClient } from '../provider';
import { PortalInfo } from '../provider/client/types/portal';
import { QualysIntegrationConfig } from '../types';
import {
  DATA_ACCOUNT_ENTITY,
  ENTITY_TYPE_QUALYS_ACCOUNT,
  STEP_FETCH_ACCOUNT,
} from './account';

export const STEP_FETCH_SERVICES = 'fetch-services';

export const ENTITY_TYPE_SERVICE_WAS = 'qualys_web_app_scanner';
export const ENTITY_TYPE_SERVICE_VMDR = 'qualys_vulnerability_manager';

export const DATA_WAS_SERVICE_ENTITY = 'DATA_WAS_SERVICE_ENTITY';
export const DATA_VMDR_SERVICE_ENTITY = 'DATA_VMDR_SERVICE_ENTITY';

export async function fetchServices({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const accountEntity = (await jobState.getData(DATA_ACCOUNT_ENTITY)) as Entity;

  const apiClient = createQualysAPIClient(logger, instance.config);
  const portalInfo = await apiClient.fetchPortalInfo();

  await Promise.all([
    createWebApplicationScannerService(jobState, accountEntity, portalInfo),
    createVulnerabilityManagementService(jobState, accountEntity, portalInfo),
  ]);
}

async function createWebApplicationScannerService(
  jobState: JobState,
  accountEntity: Entity,
  portalInfo?: PortalInfo,
): Promise<void> {
  const name = 'Qualys Web Application Scanner';
  const serviceEntity = await jobState.addEntity(
    createIntegrationEntity({
      entityData: {
        source: {},
        assign: {
          _type: ENTITY_TYPE_SERVICE_WAS,
          _class: 'Service',
          _key: `qualys-service:was`,
          displayName: name,
          name: name,
          category: ['software', 'other'],
          function: ['DAST'],
          description:
            'Automated Web Application Security Assessment and Reporting',
          version: portalInfo?.['Portal-Version']?.['WAS-VERSION'],
          createdOn: undefined,
          updatedOn: undefined,
        },
      },
    }),
  );

  await jobState.addRelationship(
    createDirectRelationship({
      _class: RelationshipClass.HAS,
      from: accountEntity,
      to: serviceEntity,
    }),
  );

  await jobState.setData(DATA_WAS_SERVICE_ENTITY, serviceEntity);
}

async function createVulnerabilityManagementService(
  jobState: JobState,
  accountEntity: Entity,
  portalInfo?: PortalInfo,
): Promise<void> {
  const name = 'Qualys Vulnerability Manager';
  const serviceEntity = await jobState.addEntity(
    createIntegrationEntity({
      entityData: {
        source: {},
        assign: {
          _type: ENTITY_TYPE_SERVICE_VMDR,
          _class: 'Service',
          _key: `qualys-service:vmdr`,
          displayName: name,
          name: name,
          category: ['software', 'other'],
          function: ['vulnerability-management'],
          description:
            'Detect, prioritize and remediate vulnerabilities, and monitor using dashboards.',
          version: portalInfo?.['Portal-Version']?.['VM-VERSION'],
          createdOn: undefined,
          updatedOn: undefined,
        },
      },
    }),
  );

  await jobState.addRelationship(
    createDirectRelationship({
      _class: RelationshipClass.HAS,
      from: accountEntity,
      to: serviceEntity,
    }),
  );

  await jobState.setData(DATA_VMDR_SERVICE_ENTITY, serviceEntity);
}

export const serviceSteps: IntegrationStep<QualysIntegrationConfig>[] = [
  {
    id: STEP_FETCH_SERVICES,
    name: 'Fetch Services',
    entities: [
      {
        _type: ENTITY_TYPE_SERVICE_WAS,
        _class: 'Service',
        resourceName: 'Web Application Scanner',
        indexMetadata: {
          enabled: true,
        },
      },
      {
        _type: ENTITY_TYPE_SERVICE_VMDR,
        _class: 'Service',
        resourceName: 'Vulnerability Manager',
        indexMetadata: {
          enabled: true,
        },
      },
    ],
    relationships: [
      {
        _type: generateRelationshipType(
          RelationshipClass.HAS,
          ENTITY_TYPE_QUALYS_ACCOUNT,
          ENTITY_TYPE_SERVICE_WAS,
        ),
        _class: RelationshipClass.HAS,
        sourceType: ENTITY_TYPE_QUALYS_ACCOUNT,
        targetType: ENTITY_TYPE_SERVICE_WAS,
        indexMetadata: {
          enabled: true,
        },
      },
      {
        _type: generateRelationshipType(
          RelationshipClass.HAS,
          ENTITY_TYPE_QUALYS_ACCOUNT,
          ENTITY_TYPE_SERVICE_VMDR,
        ),
        _class: RelationshipClass.HAS,
        sourceType: ENTITY_TYPE_QUALYS_ACCOUNT,
        targetType: ENTITY_TYPE_SERVICE_VMDR,
        indexMetadata: {
          enabled: true,
        },
      },
    ],
    dependsOn: [STEP_FETCH_ACCOUNT],
    executionHandler: fetchServices,
  },
];
