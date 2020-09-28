import {
  createDirectRelationship,
  createIntegrationEntity,
  Entity,
  IntegrationStep,
  IntegrationStepExecutionContext,
  JobState,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { TYPE_QUALYS_ACCOUNT, TYPE_QUALYS_SERVICE } from '../converters';
import { createQualysAPIClient } from '../provider';
import { PortalInfo } from '../provider/client/types/portal';
import { QualysIntegrationConfig } from '../types';
import { DATA_ACCOUNT_ENTITY, STEP_FETCH_ACCOUNT } from './account';

export const STEP_FETCH_SERVICES = 'fetch-services';
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
          _type: TYPE_QUALYS_SERVICE,
          _class: 'Service',
          _key: `qualys-service:was`,
          displayName: name,
          name: name,
          category: ['software', 'other'],
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
          _type: TYPE_QUALYS_SERVICE,
          _class: 'Service',
          _key: `qualys-service:vmdr`,
          displayName: name,
          name: name,
          category: ['software', 'other'],
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
        resourceName: 'Service',
        _type: TYPE_QUALYS_SERVICE,
        _class: 'Service',
      },
    ],
    relationships: [
      {
        _type: 'qualys_account_has_service',
        _class: RelationshipClass.HAS,
        sourceType: TYPE_QUALYS_ACCOUNT,
        targetType: TYPE_QUALYS_SERVICE,
      },
    ],
    dependsOn: [STEP_FETCH_ACCOUNT],
    executionHandler: fetchServices,
  },
];
