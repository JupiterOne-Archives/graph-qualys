import { URL } from 'url';

import {
  IntegrationExecutionContext,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';

import { DEFAULT_SCANNED_SINCE_DAYS } from './constants';
import { createQualysAPIClient } from './provider';
import { QualysIntegrationConfig } from './types';
import { getScannedSinceDate } from './util/date';

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

  if (typeof config.minScannedSinceDays === 'string') {
    const minScannedSinceDays = Number(config.minScannedSinceDays);
    if (
      !minScannedSinceDays &&
      !!(config.minScannedSinceDays as string).trim()
    ) {
      throw new IntegrationValidationError(
        'Invalid minScannedSinceDays: ' + config.minScannedSinceDays,
      );
    }
    config.minScannedSinceDays = minScannedSinceDays;
  }

  if (!config.minScannedSinceDays) {
    config.minScannedSinceDays = DEFAULT_SCANNED_SINCE_DAYS;
  }

  config.minScannedSinceISODate = getScannedSinceDate(
    config.minScannedSinceDays,
  );

  const client = createQualysAPIClient(logger, instance.config);
  await client.verifyAuthentication();
}
