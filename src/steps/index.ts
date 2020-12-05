import { accountSteps } from './account';
import { serviceSteps } from './services';
import { hostDetectionSteps } from './vmdr';
// TODO: Ingest vulnerability information
// TODO: Re-enable QID -> Finding._key collection (VulnerabilityFindingKeysCollector)
// import { vulnSteps } from './vulns';
import { webApplicationSteps } from './was';

const integrationSteps = [
  ...accountSteps,
  ...serviceSteps,
  ...webApplicationSteps,
  ...hostDetectionSteps,
  // ...vulnSteps,
];

export { integrationSteps };
