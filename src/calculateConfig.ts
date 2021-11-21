import snakeCase from 'lodash/snakeCase';

import {
  IntegrationExecutionContext,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';

import {
  DEFAULT_FINDINGS_SINCE_DAYS,
  DEFAULT_SCANNED_SINCE_DAYS,
  DEFAULT_VMDR_FINDING_SEVERITIES,
  DEFAULT_VMDR_FINDING_TYPES,
  VALID_VMDR_FINDING_TYPES,
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

  const vmdrFindingSeverityNumbers = readPropertyAsNumberArrayFromEnvOrConfig({
    config,
    propertyName: 'vmdrFindingSeverities',
    defaultValue: DEFAULT_VMDR_FINDING_SEVERITIES,
  });

  const vmdrFindingTypeValues = readPropertyAsStringArrayFromEnvOrConfig({
    config,
    propertyName: 'vmdrFindingTypes',
    defaultValue: DEFAULT_VMDR_FINDING_TYPES,
    validValues: VALID_VMDR_FINDING_TYPES,
  });

  const qidsReturnResultList = readPropertyAsNumberArrayFromEnvOrConfig({
    config,
    propertyName: 'qidsReturnResult',
    defaultValue: [],
  });

  return {
    ...config,

    minScannedSinceDays,
    minScannedSinceISODate,
    maxScannedSinceISODate,

    minFindingsSinceDays,
    minFindingsSinceISODate,
    maxFindingsSinceISODate,

    vmdrFindingSeverityNumbers,
    vmdrFindingTypeValues,
    qidsReturnResultList,
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
  } else if (value && value.includes(',')) {
    return parseArray(value.split(','));
  } else {
    const numericValue = parsePropertyAsNumber(propertyName, value);
    if (numericValue) {
      return [numericValue];
    }
  }
}

function parsePropertyAsStringArray(
  propertyName: string,
  value: string | string[] | undefined,
  validValues?: string[],
): string[] | undefined {
  const parseArray = (arr: string[]) => {
    const strings: string[] = [];
    for (const v of arr) {
      strings.push(v.trim());
    }
    if (strings.length > 0) {
      return strings;
    }
  };

  let values: string[] | undefined;

  if (value && Array.isArray(value)) {
    values = parseArray(value);
  } else if (value && value.includes(',')) {
    values = parseArray(value.split(','));
  } else if (value && !/^\s+$/.test(value)) {
    values = [value.trim()];
  }

  if (values && values.length > 0 && validValues && validValues.length > 0) {
    const invalidValues = values.reduce((invalid: string[], e) => {
      if (!validValues.includes(e)) {
        invalid.push(e);
      }
      return invalid;
    }, []);
    if (invalidValues.length > 0) {
      throw new IntegrationValidationError(
        `Invalid ${propertyName}: ${JSON.stringify(invalidValues)}`,
      );
    } else {
      return values;
    }
  } else {
    return values;
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

function readPropertyAsNumberArrayFromEnvOrConfig({
  config,
  propertyName,
  defaultValue,
}: {
  config: UserIntegrationConfig;
  propertyName: keyof UserIntegrationConfig;
  defaultValue: number[];
}): number[] {
  const envValue = readPropertyFromEnv(propertyName);
  const configValue = config[propertyName as string];
  return (
    parsePropertyAsNumberArray(propertyName, envValue) ||
    parsePropertyAsNumberArray(propertyName, configValue) ||
    defaultValue
  );
}

function readPropertyAsStringArrayFromEnvOrConfig({
  config,
  propertyName,
  defaultValue,
  validValues,
}: {
  config: UserIntegrationConfig;
  propertyName: keyof UserIntegrationConfig;
  validValues?: string[];
  defaultValue: string[];
}): string[] {
  const envValue = readPropertyFromEnv(propertyName);
  const configValue = config[propertyName as string];
  return (
    parsePropertyAsStringArray(propertyName, envValue, validValues) ||
    parsePropertyAsStringArray(propertyName, configValue, validValues) ||
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
