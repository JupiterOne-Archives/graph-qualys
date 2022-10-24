import {
  IntegrationExecutionContext,
  IntegrationValidationError,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import { calculateConfig } from './calculateConfig';
import { createQualysAPIClient } from './provider';
import { STEP_FETCH_ACCOUNT } from './steps/account';
import { STEP_FETCH_SERVICES } from './steps/services';
import {
  STEP_FETCH_SCANNED_HOST_DETAILS,
  STEP_FETCH_SCANNED_HOST_FINDINGS,
  STEP_FETCH_SCANNED_HOST_IDS,
} from './steps/vmdr/constants';
import { STEP_FETCH_FINDING_VULNS } from './steps/vulns/constants';
import {
  STEP_FETCH_ASSESSMENTS,
  STEP_FETCH_SCANNED_WEBAPPS,
  STEP_FETCH_SCANNED_WEBAPP_FINDINGS,
} from './steps/was/constants';
import { UserIntegrationConfig } from './types';
import { validateApiUrl } from './validateApiUrl';

const REQUIRED_PROPERTIES = [
  'qualysUsername',
  'qualysPassword',
  'qualysApiUrl',
];

export async function validateInvocation(
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
  logger.info('Verifying Authentication');
  await client.verifyAuthentication();
  logger.info('Authentication Verified');

  instance.config = calculatedConfig;
}

export function getStepStartStates(
  context: IntegrationExecutionContext<UserIntegrationConfig>,
): StepStartStates {
  const { config } = context.instance;
  const ingestWebAppScans = !!config.ingestWebAppScans;

  return {
    [STEP_FETCH_ACCOUNT]: {
      disabled: false,
    },
    [STEP_FETCH_SERVICES]: {
      disabled: false,
    },
    [STEP_FETCH_SCANNED_WEBAPPS]: {
      disabled: !ingestWebAppScans,
    },
    [STEP_FETCH_SCANNED_WEBAPP_FINDINGS]: {
      disabled: false,
    },
    [STEP_FETCH_SCANNED_HOST_IDS]: {
      disabled: false,
    },
    [STEP_FETCH_SCANNED_HOST_DETAILS]: {
      disabled: false,
    },
    [STEP_FETCH_SCANNED_HOST_FINDINGS]: {
      disabled: false,
    },
    [STEP_FETCH_FINDING_VULNS]: {
      disabled: false,
    },
    [STEP_FETCH_ASSESSMENTS]: {
      disabled: false,
    },
  };
}
