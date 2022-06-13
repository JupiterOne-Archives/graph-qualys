import {
  DEFAULT_FINDINGS_SINCE_DAYS,
  DEFAULT_SCANNED_SINCE_DAYS,
  DEFAULT_VMDR_FINDING_RESULT_QIDS,
  DEFAULT_WEB_APP_SCAN_APPLICATION_ID_FILTER,
} from '../src/constants';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { QualysIntegrationConfig } from '../src/types';

if (process.env.LOAD_ENV) {
  dotenv.config({
    path: path.join(__dirname, '../.env'),
  });
}

export const config = {
  qualysApiUrl:
    process.env.QUALYS_API_URL || 'https://qualysapi.qg3.apps.qualys.com',
  qualysPassword: process.env.QUALYS_PASSWORD || 'password',
  qualysUsername: process.env.QUALYS_USERNAME || 'upter3sa',
  minScannedSinceDays: DEFAULT_SCANNED_SINCE_DAYS,
  minFindingsSinceDays: DEFAULT_FINDINGS_SINCE_DAYS,
  vmdrFindingResultQidNumbers: DEFAULT_VMDR_FINDING_RESULT_QIDS,
  webAppScanApplicationIDs: DEFAULT_WEB_APP_SCAN_APPLICATION_ID_FILTER,
} as QualysIntegrationConfig;
