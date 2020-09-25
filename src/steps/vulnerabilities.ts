import { IntegrationStep } from '@jupiterone/integration-sdk-core';
import { TYPE_QUALYS_WEB_APP } from '../converters';
import { QualysIntegrationConfig } from '../types';

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
    relationships: [
      {
        _type: 'fastly_account_has_user',
        _class: RelationshipClass.HAS,
        sourceType: 'fastly_account',
        targetType: 'fastly_user',
      },
    ],
    dependsOn: ['fetch-account'],
    executionHandler: fetchUsers,
  },
  {
    id: 'fetch-tokens',
    name: 'Fetch API Tokens',
    entities: [
      {
        resourceName: 'API Token',
        _type: 'fastly_api_token',
        _class: 'AccessKey',
      },
    ],
    relationships: [
      {
        _type: 'fastly_account_has_api_token',
        _class: RelationshipClass.HAS,
        sourceType: 'fastly_account',
        targetType: 'fastly_api_token',
      },
      {
        _type: 'fastly_user_has_api_token',
        _class: RelationshipClass.HAS,
        sourceType: 'fastly_user',
        targetType: 'fastly_api_token',
      },
    ],
    dependsOn: ['fetch-account'],
    executionHandler: fetchTokens,
  },
];
