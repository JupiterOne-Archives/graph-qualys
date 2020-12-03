import { URL } from 'url';

import {
  IntegrationExecutionContext,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';

import { createQualysAPIClient } from './provider';
import { QualysIntegrationConfig } from './types';
import { calculateConfig } from './calculateConfig';

const REQUIRED_PROPERTIES = [
  'qualysUsername',
  'qualysPassword',
  'qualysApiUrl',
];

export default async function validateInvocation(
  context: IntegrationExecutionContext<QualysIntegrationConfig>,
): Promise<void> {
  const { logger, instance } = context;

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

  const client = createQualysAPIClient(logger, config);
  await client.verifyAuthentication();
  client.validateApiUrl();

  const calculatedConfig = calculateConfig(context);
  instance.config = calculatedConfig;

  logger.info(
    {
      // TODO: The SDK should be safely logging; the serializer for
      // integrationInstanceConfig will prevent logging masked fields or fields
      // not declared in the instanceConfigFields.
      integrationInstanceConfig: calculateConfig,

      // TODO: Remove these once virtual instanceConfigFields is supported
      minScannedSinceISODate: calculatedConfig.minScannedSinceISODate,
      maxScannedSinceISODate: calculatedConfig.maxScannedSinceISODate,
      minFindingsSinceISODate: calculatedConfig.minFindingsSinceISODate,
      maxFindingsSinceISODate: calculatedConfig.maxFindingsSinceISODate,
    },
    'Configuration validated',
  );
}
