import { accountSteps } from './account';
import { serviceSteps } from './services';
import { hostDetectionSteps } from './vmdr';
import { vulnSteps } from './vulns';
import { webApplicationSteps } from './was';

const integrationSteps = [
  ...accountSteps,
  ...serviceSteps,
  ...webApplicationSteps,
  ...hostDetectionSteps,
  ...vulnSteps,
];

export { integrationSteps };
