import { PossibleArray, ISODateString } from '../../types';

export interface FetchScanResultsReply {
  WasScan?: WasScan;
}

export interface WasScan {
  id?: number;
  name?: string;
  reference?: string;
  type?: string;
  mode?: string;
  multi?: boolean;
  target?: Target;
  profile?: Profile;
  options?: Options;
  launchedDate?: ISODateString;
  launchedBy?: LaunchedBy;
  status?: string;
  endScanDate?: ISODateString;
  scanDuration?: number;
  summary?: Summary;
  stats?: Stats;
  vulns?: Vulns;
  sensitiveContents?: SensitiveContents;
  igs?: Igs;
  sendMail?: boolean;
  enableWAFAuth?: boolean;
}

export interface Igs {
  count?: number;
  list?: IgsList;
}

export interface IgsList {
  WasScanIg?: PossibleArray<WasScanIg>;
}

export interface WasScanIg {
  qid?: number;
  title?: string;
  data?: string;
  sslData?: SSLData;
}

export interface SSLData {
  protocol?: string;
  ip?: string;
  result?: string;
}

export interface LaunchedBy {
  id?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface Options {
  count?: number;
  list?: OptionsList;
}

export interface OptionsList {
  WasScanOption?: PossibleArray<WasScanOption>;
}

export interface WasScanOption {
  name?: string;
  value?: string;
}

export interface Profile {
  id?: number;
  name?: string;
}

export interface SensitiveContents {
  count?: number;
}

export interface Stats {
  global?: { [key: string]: number };
  byGroup?: ByGroup;
  byOwasp?: ByOwasp;
  byWasc?: ByWasc;
}

export interface ByGroup {
  count?: number;
  list?: ByGroupList;
}

export interface ByGroupList {
  GroupStat?: PossibleArray<Stat>;
}

export interface Stat {
  group?: string;
  nbTotal?: number;
  nbLevel5?: number;
  nbLevel4?: number;
  nbLevel3?: number;
  nbLevel2?: number;
  nbLevel1?: number;
  owasp?: string;
  wasc?: string;
}

export interface ByOwasp {
  count?: number;
  list?: ByOwaspList;
}

export interface ByOwaspList {
  OwaspStat?: PossibleArray<Stat>;
}

export interface ByWasc {
  count?: number;
  list?: ByWascList;
}

export interface ByWascList {
  WascStat?: PossibleArray<Stat>;
}

export interface Summary {
  crawlDuration?: number;
  testDuration?: number;
  linksCrawled?: number;
  nbRequests?: number;
  resultsStatus?: string;
  authStatus?: string;
  os?: string;
}

export interface Target {
  webApp?: WebApp;
  scannerAppliance?: ScannerAppliance;
  cancelOption?: string;
}

export interface ScannerAppliance {
  type?: string;
}

export interface WebApp {
  id?: number;
  name?: string;
  url?: string;
}

export interface Vulns {
  count?: number;
  list?: VulnsList;
}

export interface VulnsList {
  WasScanVuln?: PossibleArray<WasScanVuln>;
}

export interface WasScanVuln {
  qid?: number;
  title?: string;
  uri?: string;
  param?: string;
  instances?: Instances;
}

export interface Instances {
  count?: number;
  list?: InstancesList;
}

export interface InstancesList {
  WasScanVulnInstance?: WasScanVulnInstance;
}

export interface WasScanVulnInstance {
  authenticated?: boolean;
  form?: string;
  payloads?: Payloads;
}

export interface Payloads {
  count?: number;
  list?: PayloadsList;
}

export interface PayloadsList {
  WasScanVulnPayload?: PossibleArray<WasScanVulnPayloadElement>;
}

export interface WasScanVulnPayloadElement {
  payload?: string;
  result?: string;
}
