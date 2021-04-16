import {
  IntegrationExecutionContext,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';

import { calculateConfig } from './calculateConfig';
import { createQualysAPIClient } from './provider';
import { UserIntegrationConfig } from './types';
import { validateApiUrl } from './validateApiUrl';

const REQUIRED_PROPERTIES = [
  'qualysUsername',
  'qualysPassword',
  'qualysApiUrl',
];

export default async function validateInvocation(
  context: IntegrationExecutionContext<UserIntegrationConfig>,
): Promise<void> {
  const { logger, instance } = context;

  for (const key of REQUIRED_PROPERTIES) {
    if (!instance.config[key]) {
      throw new IntegrationValidationError(
        'Missing required config property: ' + key,
      );
    }
  }

  const calculatedConfig = calculateConfig(context);
  logger.info(
    {
      // TODO: The SDK should be safely logging; the serializer for
      // integrationInstanceConfig will prevent logging masked fields or fields
      // not declared in the instanceConfigFields.
      integrationInstanceConfig: calculatedConfig,

      // TODO: Remove these once virtual instanceConfigFields is supported
      minScannedSinceISODate: calculatedConfig.minScannedSinceISODate,
      maxScannedSinceISODate: calculatedConfig.maxScannedSinceISODate,
      minFindingsSinceISODate: calculatedConfig.minFindingsSinceISODate,
      maxFindingsSinceISODate: calculatedConfig.maxFindingsSinceISODate,
    },
    'Configuration loaded',
  );

  validateApiUrl(calculatedConfig.qualysApiUrl);

  const client = createQualysAPIClient(logger, calculatedConfig);
  await client.verifyAuthentication();

  instance.config = calculatedConfig;
}
