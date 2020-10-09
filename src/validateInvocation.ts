import { URL } from 'url';

import {
  IntegrationExecutionContext,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';

import { createQualysAPIClient } from './provider';
import { QualysIntegrationConfig } from './types';

const REQUIRED_PROPERTIES = [
  'qualysUsername',
  'qualysPassword',
  'qualysApiUrl',
];

export default async function validateInvocation({
  logger,
  instance,
}: IntegrationExecutionContext<QualysIntegrationConfig>): Promise<void> {
  const config = instance.config;

  for (const key of REQUIRED_PROPERTIES) {
    if (!config[key]) {
      throw new IntegrationValidationError(
        'Missing required config property: ' + key,
      );
    }
  }

  try {
    new URL(config.qualysApiUrl);
  } catch (err) {
    throw new IntegrationValidationError(
      'Invalid API URL: ' + config.qualysApiUrl,
    );
  }

  const client = createQualysAPIClient(logger, instance.config);
  await client.verifyAuthentication();
}
