import { webAppSteps } from './webApps';
import { hostSteps } from './hosts';

const integrationSteps = [...webAppSteps, ...hostSteps];

export { integrationSteps };
