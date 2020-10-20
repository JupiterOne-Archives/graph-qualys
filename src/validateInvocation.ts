import snakeCase from 'lodash/snakeCase';
import { URL } from 'url';

import {
  IntegrationExecutionContext,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';

import {
  DEFAULT_FINDINGS_SINCE_DAYS,
  DEFAULT_SCANNED_SINCE_DAYS,
} from './constants';
import { createQualysAPIClient } from './provider';
import { QualysIntegrationConfig } from './types';

const REQUIRED_PROPERTIES = [
  'qualysUsername',
  'qualysPassword',
  'qualysApiUrl',
];

// TODO: Support numeric values in IntegrationInstanceConfigFieldMap
// TOOD: Remove config modification code once numeric types supported
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

  assignPropertyAsNumberFromEnvOrConfig(
    config,
    'minScannedSinceDays',
    DEFAULT_SCANNED_SINCE_DAYS,
  );
  config.minScannedSinceISODate = isoDate(config.minScannedSinceDays);

  assignPropertyAsNumberFromEnvOrConfig(
    config,
    'minFindingsSinceDays',
    DEFAULT_FINDINGS_SINCE_DAYS,
  );
  config.minFindingsSinceISODate = isoDate(config.minFindingsSinceDays);

  // TODO: The SDK should be logging this information; the serializer for
  // integrationInstanceConfig will prevent logging masked or fields not
  // declared in the instanceConfigFields.
  logger.info(
    { integrationInstanceConfig: config },
    'Configuration values validated, verifying authentication...',
  );

  const client = createQualysAPIClient(logger, config);
  await client.verifyAuthentication();
}

function readPropertyFromEnv(propertyName: string): string | undefined {
  const envName = snakeCase(propertyName).toUpperCase();
  return process.env[envName];
}

function parsePropertyAsNumber(
  propertyName: string,
  value: string | undefined,
): number | undefined {
  if (!value) return undefined;

  const numericValue = Number(value) || undefined;
  if (!numericValue && !!value.trim()) {
    throw new IntegrationValidationError(`Invalid ${propertyName}: ${value}`);
  }

  return numericValue;
}

function assignPropertyAsNumberFromEnvOrConfig(
  config: QualysIntegrationConfig,
  propertyName: keyof QualysIntegrationConfig,
  defaultValue: number,
): void {
  const envValue = readPropertyFromEnv(propertyName);
  const configValue = config[propertyName as string];
  config[propertyName as string] =
    parsePropertyAsNumber(propertyName, envValue) ||
    parsePropertyAsNumber(propertyName, configValue) ||
    defaultValue;
}

const MILLISECONDS_ONE_DAY = 1000 * 60 * 60 * 24;

function isoDate(sinceDays: number) {
  return new Date(Date.now() - sinceDays * MILLISECONDS_ONE_DAY)
    .toISOString()
    .replace(/\.\d{1,3}/, '');
}
