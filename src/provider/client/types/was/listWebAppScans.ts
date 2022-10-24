import { ServiceResponseBody } from '../qps';
import { ISODateString, PossibleArray } from '../util';

export type ListWebAppScansFilterInputParameter =
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
  | 'lastScan.date'
  | 'webApp.id'
  | 'format';

export type ListWebAppScansFilters = Partial<
  Record<
    ListWebAppScansFilterInputParameter,
    string | string[] | boolean | number | number[]
  >
>;

export type ListWebAppScansPagination = { limit: number; offset?: number };

export type ListWasScanResponse = ServiceResponseBody<WasScanData>;

export type WasScanData = {
  WasScan?: PossibleArray<WasScan>;
};

export type WasScan = {
  id?: number;
  name?: string;
  reference?: string;
  type?: string;
  mode?: string;
  multi?: boolean;

  target?: any;
  profile?: any;
  launchedDate?: ISODateString;
  launchedBy?: any;

  status?: string;
  summary?: any;
};

export type WasCreateScanReportResponse = ServiceResponseBody<ScanReportData>;

export type WasScanReportResponse = {
  WAS_SCAN_REPORT: WasScanReport;
};

export type WasScanReport = {
  HEADER: {
    GENERATION_DATETIME: string;
  };
  FILTERS: any;
  TARGET: {
    SCAN: string;
  };
  SUMMARY: {
    GLOBAL_SUMMARY: {
      SECURITY_RISK: string;
      VULNERABILITY: number;
      SENSITIVE_CONTENT: number;
      INFORMATION_GATHERED: number;
    };
  };
  RESULTS: any;
  GLOSSARY: any;
  APPENDIX: {
    WEBAPP: {
      ID: number;
      NAME: string;
      URL: string;
    };
  };
};

export type ScanReportData = {
  Report?: PossibleArray<ScanReport>;
};

export type ScanReport = {
  id?: number;
};

export type WasSearchReportResponse = ServiceResponseBody<SearchReportData>;

export type SearchReportData = {
  Report?: PossibleArray<SearchScanReport>;
};

export type SearchScanReport = {
  id: number;
  name: string;
  owner: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  };
  type: string;
  format: string;
  status: string;
  size: number;
  creationDate: string;
  tags: {
    count: number;
  };
};
