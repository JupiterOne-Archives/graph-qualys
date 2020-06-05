import { IntegrationInvocationConfig } from '@jupiterone/integration-sdk-core';

import instanceConfigFields from './instanceConfigFields';
import validateInvocation from './validateInvocation';

import collectData from './steps/collect-data';
import { QualysIntegrationConfig } from './types';

export const invocationConfig: IntegrationInvocationConfig<QualysIntegrationConfig> = {
  instanceConfigFields,
  validateInvocation,
  integrationSteps: [collectData],
};
