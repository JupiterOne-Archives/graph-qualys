import { DEFAULT_SCANNED_SINCE_DAYS } from '../src/constants';
import { QualysIntegrationConfig } from '../src/types';

export const config: QualysIntegrationConfig = {
  qualysApiUrl:
    process.env.QUALYS_API_URL || 'https://qualysapi.qg3.apps.qualys.com',
  qualysPassword: process.env.QUALYS_PASSWORD || 'password',
  qualysUsername: process.env.QUALYS_USERNAME || 'upter3aw',
  minScannedSinceDays: DEFAULT_SCANNED_SINCE_DAYS,
  minScannedSinceISODate: '2020-09-11T23:00:30Z',
};
