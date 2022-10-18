import {
  createIntegrationEntity,
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

import { createQualysAPIClient } from '../provider';
import { QualysIntegrationConfig } from '../types';

export const STEP_FETCH_ACCOUNT = 'fetch-account';

export const ENTITY_TYPE_QUALYS_ACCOUNT = 'qualys_account';

export const DATA_ACCOUNT_ENTITY = 'DATA_ACCOUNT_ENTITY';

export async function fetchAccountDetails({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);

  const data = await apiClient.fetchPortalInfo();
  const name = `Qualys - ${instance.name}`;

  const accountEntity = createIntegrationEntity({
    entityData: {
      source: {
        portal: data,
      },
      assign: {
        _type: ENTITY_TYPE_QUALYS_ACCOUNT,
        _class: 'Account',
        _key: `qualys-account:${instance.id}`,
        name,
        displayName: name,
      },
    },
  });

  await Promise.all([
    jobState.addEntity(accountEntity),
    jobState.setData(DATA_ACCOUNT_ENTITY, accountEntity),
  ]);
}

export const accountSteps: IntegrationStep<QualysIntegrationConfig>[] = [
  {
    id: STEP_FETCH_ACCOUNT,
    name: 'Fetch Account Details',
    entities: [
      {
        resourceName: 'Account',
        _type: ENTITY_TYPE_QUALYS_ACCOUNT,
        _class: 'Account',
        indexMetadata: {
          enabled: true,
        },
      },
    ],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchAccountDetails,
  },
];
