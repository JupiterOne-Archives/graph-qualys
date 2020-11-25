import {
  DEFAULT_FINDINGS_SINCE_DAYS,
  DEFAULT_SCANNED_SINCE_DAYS,
} from '../src/constants';
import { QualysIntegrationConfig } from '../src/types';

export const config = {
  qualysApiUrl:
    process.env.QUALYS_API_URL || 'https://qualysapi.qg3.apps.qualys.com',
  qualysPassword: process.env.QUALYS_PASSWORD || 'password',
  qualysUsername: process.env.QUALYS_USERNAME || 'upter3aw',
  minScannedSinceDays: DEFAULT_SCANNED_SINCE_DAYS,
  minFindingsSinceDays: DEFAULT_FINDINGS_SINCE_DAYS,
} as QualysIntegrationConfig;
