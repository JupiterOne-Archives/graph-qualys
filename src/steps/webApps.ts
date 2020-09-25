import {
  createIntegrationEntity,
  IntegrationStep,
  IntegrationStepExecutionContext,
  parseTimePropertyValue,
} from '@jupiterone/integration-sdk-core';

import { buildWebAppKey, TYPE_QUALYS_WEB_APP } from '../converters';
import { createQualysAPIClient } from '../provider';
import { QualysIntegrationConfig } from '../types';

export async function fetchWebApps({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);

  await apiClient.iterateWebApps(async (data) => {
    await jobState.addEntity(
      createIntegrationEntity({
        entityData: {
          source: data as any,
          assign: {
            _type: TYPE_QUALYS_WEB_APP,
            _key: buildWebAppKey({
              webAppId: data.id!,
            }),
            _class: 'Application',
            id: String(data.id),
            name: data.name!,
            displayName: data.name!,
            createdOn: parseTimePropertyValue(data.createdDate),
            updatedOn: parseTimePropertyValue(data.updatedDate),
          },
        },
      }),
    );
  });
}

export const webAppSteps: IntegrationStep<QualysIntegrationConfig>[] = [
  {
    id: 'fetch-webapps',
    name: 'Fetch Web Apps',
    entities: [
      {
        _type: TYPE_QUALYS_WEB_APP,
        _class: 'Application',
        resourceName: 'Web App',
      },
    ],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchWebApps,
  },
];
