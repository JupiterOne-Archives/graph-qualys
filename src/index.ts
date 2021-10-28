import { IntegrationInvocationConfig } from '@jupiterone/integration-sdk-core';

import instanceConfigFields from './instanceConfigFields';
import { integrationSteps } from './steps';
import { QualysIntegrationConfig } from './types';
import { validateInvocation, getStepStartStates } from './validateInvocation';

export const invocationConfig: IntegrationInvocationConfig<QualysIntegrationConfig> = {
  instanceConfigFields: instanceConfigFields as any,
  validateInvocation,
  getStepStartStates,
  integrationSteps,
  dependencyGraphOrder: ['last'],
};
