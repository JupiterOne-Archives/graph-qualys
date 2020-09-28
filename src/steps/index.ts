import { accountSteps } from './account';
import { serviceSteps } from './services';
import { hostDetectionSteps } from './vmdr';
import { webApplicationSteps } from './was';

const integrationSteps = [
  ...accountSteps,
  ...serviceSteps,
  ...webApplicationSteps,
  ...hostDetectionSteps,
];

export { integrationSteps };
