import { QualysIntegrationConfig } from '../src/types';

export const config: QualysIntegrationConfig = {
  qualysApiUrl:
    process.env.QUALYS_API_URL || 'https://qualysapi.qg3.apps.qualys.com',
  qualysPassword: process.env.QUALYS_PASSWORD || 'password',
  qualysUsername: process.env.QUALYS_USERNAME || 'upter3aw',
};
