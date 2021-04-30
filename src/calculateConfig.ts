import snakeCase from 'lodash/snakeCase';

import {
  IntegrationExecutionContext,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';

import {
  DEFAULT_FINDINGS_SINCE_DAYS,
  DEFAULT_SCANNED_SINCE_DAYS,
  DEFAULT_VMDR_FINDING_SEVERITIES,
} from './constants';
import { CalculatedIntegrationConfig, UserIntegrationConfig } from './types';

export function calculateConfig({
  instance,
  executionHistory,
}: IntegrationExecutionContext<
  UserIntegrationConfig
>): CalculatedIntegrationConfig {
  const config = instance.config;

  const now = Date.now();
  const lastSuccessfulExecutionTime =
    executionHistory.lastSuccessful?.startedOn || 0;

  const minScannedSinceDays = readPropertyAsNumberFromEnvOrConfig(
    config,
    'minScannedSinceDays',
    DEFAULT_SCANNED_SINCE_DAYS,
  );
  const minScannedSinceTime = sinceDaysTime({
    now,
    sinceDays: minScannedSinceDays,
  });
  const minScannedSinceISODate =
    lastSuccessfulExecutionTime > minScannedSinceTime
      ? isoDate(lastSuccessfulExecutionTime)
      : isoDate(minScannedSinceTime);
  const maxScannedSinceISODate = isoDate(executionHistory.current.startedOn);

  const minFindingsSinceDays = readPropertyAsNumberFromEnvOrConfig(
    config,
    'minFindingsSinceDays',
    DEFAULT_FINDINGS_SINCE_DAYS,
  );
  const minFindingsSinceTime = sinceDaysTime({
    now,
    sinceDays: minFindingsSinceDays,
  });
  const minFindingsSinceISODate =
    lastSuccessfulExecutionTime > minFindingsSinceTime
      ? isoDate(lastSuccessfulExecutionTime)
      : isoDate(minFindingsSinceTime);
  const maxFindingsSinceISODate = isoDate(executionHistory.current.startedOn);

  const vmdrFindingSeverityNumbers = readPropertyAsNumberArrayFromEnvOrConfig(
    config,
    'vmdrFindingSeverities',
    DEFAULT_VMDR_FINDING_SEVERITIES,
  );

  return {
    ...config,

    minScannedSinceDays,
    minScannedSinceISODate,
    maxScannedSinceISODate,

    minFindingsSinceDays,
    minFindingsSinceISODate,
    maxFindingsSinceISODate,

    vmdrFindingSeverityNumbers,
  };
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

function parsePropertyAsNumberArray(
  propertyName: string,
  value: string | string[] | undefined,
): number[] | undefined {
  const parseArray = (arr: string[]) => {
    const numbers: number[] = [];
    for (const v of arr) {
      const numericValue = parsePropertyAsNumber(propertyName, v);
      if (numericValue) {
        numbers.push(numericValue);
      }
    }
    if (numbers.length > 0) {
      return numbers;
    }
  };

  if (value && Array.isArray(value)) {
    return parseArray(value);
  } else if (value && value.indexOf(',')) {
    return parseArray(value.split(','));
  } else {
    const numericValue = parsePropertyAsNumber(propertyName, value);
    if (numericValue) {
      return [numericValue];
    }
  }
}

function readPropertyAsNumberFromEnvOrConfig(
  config: UserIntegrationConfig,
  propertyName: keyof UserIntegrationConfig,
  defaultValue: number,
): number {
  const envValue = readPropertyFromEnv(propertyName);
  const configValue = config[propertyName as string];
  return (
    parsePropertyAsNumber(propertyName, envValue) ||
    parsePropertyAsNumber(propertyName, configValue) ||
    defaultValue
  );
}

function readPropertyAsNumberArrayFromEnvOrConfig(
  config: UserIntegrationConfig,
  propertyName: keyof UserIntegrationConfig,
  defaultValue: number[],
): number[] {
  const envValue = readPropertyFromEnv(propertyName);
  const configValue = config[propertyName as string];
  return (
    parsePropertyAsNumberArray(propertyName, envValue) ||
    parsePropertyAsNumberArray(propertyName, configValue) ||
    defaultValue
  );
}

const MILLISECONDS_ONE_DAY = 1000 * 60 * 60 * 24;

function sinceDaysTime(input: { now: number; sinceDays: number }): number {
  return input.now - input.sinceDays * MILLISECONDS_ONE_DAY;
}

function isoDate(time: number) {
  return new Date(time).toISOString().replace(/\.\d{1,3}/, '');
}
