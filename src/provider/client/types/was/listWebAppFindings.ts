// https://qualysapi.qualys.com/qps/xsd/3.0/was/finding.xsd

import { QualyNumericSeverity } from '../../../../types';
import { PossibleArray } from '../util';
import { ServiceResponse } from './serviceResponse';

export type ListWebAppFindingsFilterInputParameter =
  | 'webApp.id'
  | 'lastDetectedDate';

export type ListWebAppFindingsFilters = Partial<
  Record<
    ListWebAppFindingsFilterInputParameter,
    string | string[] | boolean | number | number[]
  >
>;

export type ListWebAppFindingsResponse = {
  ServiceResponse?: ServiceResponse<WebAppFindingsData>;
};

export type WebAppFindingsData = {
  Finding?: PossibleArray<WebAppFinding>;
};

export type WebAppFinding = {
  id?: number;
  uniqueId?: string;
  qid?: number;
  name?: string;
  type?: 'VULNERABILITY' | 'SENSITIVE_CONTENT' | 'INFORMATION_GATHERED';
  findingType?: 'QUALYS' | 'BURP' | 'BUGCROWD';
  status?: 'NEW' | 'ACTIVE' | 'REOPENED' | 'FIXED' | 'PROTECTED';
  isIgnored?: boolean;
  severity?: QualyNumericSeverity;
  url?: string;
  firstDetectedDate?: string; // "YYYY-MM-DDThh:mm:ss"
  lastDetectedDate?: string;
  lastTestedDate?: string;
  timesDetected?: number;
  webApp?: FindingWebApp;
};

export type FindingWebApp = {
  id?: number;
  name?: string;
  url?: string;
};
