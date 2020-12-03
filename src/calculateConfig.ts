import snakeCase from 'lodash/snakeCase';

import {
  IntegrationExecutionContext,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';

import {
  DEFAULT_FINDINGS_SINCE_DAYS,
  DEFAULT_SCANNED_SINCE_DAYS,
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

  return {
    ...config,

    minScannedSinceDays,
    minScannedSinceISODate,
    maxScannedSinceISODate,

    minFindingsSinceDays,
    minFindingsSinceISODate,
    maxFindingsSinceISODate,
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

const MILLISECONDS_ONE_DAY = 1000 * 60 * 60 * 24;

function sinceDaysTime(input: { now: number; sinceDays: number }): number {
  return input.now - input.sinceDays * MILLISECONDS_ONE_DAY;
}

function isoDate(time: number) {
  return new Date(time).toISOString().replace(/\.\d{1,3}/, '');
}
