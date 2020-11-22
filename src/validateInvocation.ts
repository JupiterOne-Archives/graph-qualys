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
  history,
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

  const now = Date.now();
  const lastSuccessfulExecutionTime =
    history?.lastSuccessfulExecution?.startedOn || 0;

  assignPropertyAsNumberFromEnvOrConfig(
    config,
    'minScannedSinceDays',
    DEFAULT_SCANNED_SINCE_DAYS,
  );
  const minScannedSinceTime = sinceDaysTime({
    now,
    sinceDays: config.minScannedSinceDays,
  });
  if (lastSuccessfulExecutionTime > minScannedSinceTime) {
    config.minScannedSinceISODate = isoDate(lastSuccessfulExecutionTime);
  } else {
    config.minScannedSinceISODate = isoDate(minScannedSinceTime);
  }

  assignPropertyAsNumberFromEnvOrConfig(
    config,
    'minFindingsSinceDays',
    DEFAULT_FINDINGS_SINCE_DAYS,
  );
  const minFindingsSinceTime = sinceDaysTime({
    now,
    sinceDays: config.minFindingsSinceDays,
  });
  if (lastSuccessfulExecutionTime > minFindingsSinceTime) {
    config.minFindingsSinceISODate = isoDate(lastSuccessfulExecutionTime);
  } else {
    config.minFindingsSinceISODate = isoDate(minFindingsSinceTime);
  }

  logger.info(
    {
      // TODO: The SDK should be safely logging; the serializer for
      // integrationInstanceConfig will prevent logging masked fields or fields
      // not declared in the instanceConfigFields.
      integrationInstanceConfig: config,

      lastSuccessfulExecutionTime: lastSuccessfulExecutionTime
        ? isoDate(lastSuccessfulExecutionTime)
        : undefined,

      // TODO: Remove these once virtual instanceConfigFields is supported
      minScannedSinceISODate: config.minScannedSinceISODate,
      minFindingsSinceISODate: config.minFindingsSinceISODate,
    },
    'Configuration values validated, verifying authentication...',
  );

  const client = createQualysAPIClient(logger, config);
  await client.verifyAuthentication();
  client.validateApiUrl();
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

function sinceDaysTime(input: { now: number; sinceDays: number }): number {
  return input.now - input.sinceDays * MILLISECONDS_ONE_DAY;
}

function isoDate(time: number) {
  return new Date(time).toISOString().replace(/\.\d{1,3}/, '');
}
