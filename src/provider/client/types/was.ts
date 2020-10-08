// TODO Make these types instead of interfaces, since they do nothing but document the API response data.

import { PossibleArray, ISODateString } from './util';

export type ListWebAppsFilterInputParameter =
  | 'id'
  | 'name'
  | 'url'
  | 'tags.name'
  | 'tags.id'
  | 'createdDate'
  | 'updatedDate'
  | 'isScheduled'
  | 'isScanned'
  | 'lastScan.status'
  | 'lastScan.date';

export type ListWebAppsFilters = Partial<
  Record<ListWebAppsFilterInputParameter, string | boolean | number>
>;

export type ListWebAppsPagination = { limit: number; offset?: number };

export interface ListWebAppsResponse {
  ServiceResponse?: ServiceResponse<WebAppData>;
}

export interface ServiceResponse<DataType> {
  responseCode?: string;
  count?: number;
  hasMoreRecords?: boolean;
  data?: DataType;
}

export interface WebAppData {
  WebApp?: PossibleArray<WebApp>;
}

export interface WebApp {
  id?: number;
  name?: string;
  url?: string;
  owner?: Owner;
  tags?: Tags;
  createdDate?: ISODateString;
  updatedDate?: ISODateString;
}

export interface Owner {
  id?: number;
}

export interface Tags {
  count?: number;
}

// https://qualysapi.qg3.apps.qualys.com/qps/xsd/3.0/was/finding.xsd

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
  severity?: number;
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
