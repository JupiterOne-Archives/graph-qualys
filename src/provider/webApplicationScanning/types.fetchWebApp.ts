import { PossibleArray, ISODateString } from '../../types';

export interface FetchWebAppReply {
  ServiceResponse?: ServiceResponse;
}

export interface ServiceResponse {
  responseCode?: string;
  count?: number;
  data?: Data;
}

export interface Data {
  WebApp?: WebApp;
}

export interface WebApp {
  id?: number;
  name?: string;
  url?: string;
  os?: string;
  owner?: CreatedBy;
  scope?: string;
  attributes?: Attributes;
  defaultProfile?: DefaultProfile;
  defaultScanner?: DefaultScanner;
  scannerLocked?: boolean;
  urlBlacklist?: AuthRecords;
  urlWhitelist?: AuthRecords;
  postDataBlacklist?: AuthRecords;
  logoutRegexList?: AuthRecords;
  authRecords?: AuthRecords;
  dnsOverrides?: AuthRecords;
  useRobots?: string;
  useSitemap?: boolean;
  malwareMonitoring?: boolean;
  malwareNotification?: boolean;
  malwareScheduling?: MalwareScheduling;
  tags?: AuthRecords;
  comments?: Comments;
  isScheduled?: boolean;
  lastScan?: LastScan;
  createdBy?: CreatedBy;
  createdDate?: ISODateString;
  updatedBy?: CreatedBy;
  updatedDate?: ISODateString;
  screenshot?: string;
  config?: string;
  crawlingScripts?: AuthRecords;
}

export interface Attributes {
  count?: number;
  list?: AttributesList;
}

export interface AttributesList {
  Attribute?: PossibleArray<Attribute>;
}

export interface Attribute {
  name?: string;
  value?: string;
}

export interface AuthRecords {
  count?: number;
}

export interface Comments {
  count?: number;
  list?: CommentsList;
}

export interface CommentsList {
  Comment?: PossibleArray<Comment>;
}

export interface Comment {
  contents?: string;
  author?: Author;
  createdDate?: ISODateString;
}

export interface Author {
  id?: number;
  username?: string;
}

export interface CreatedBy {
  id?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface DefaultProfile {
  id?: number;
  name?: string;
}

export interface DefaultScanner {
  type?: string;
}

export interface LastScan {
  id?: number;
  name?: string;
  summary?: Summary;
}

export interface Summary {
  resultsStatus?: string;
  authStatus?: string;
}

export interface MalwareScheduling {
  startDate?: ISODateString;
  timeZone?: TimeZone;
  occurrenceType?: string;
  occurrence?: Occurrence;
}

export interface Occurrence {
  dailyOccurrence?: DailyOccurrence;
}

export interface DailyOccurrence {
  everyNDays?: number;
  occurrenceCount?: number;
}

export interface TimeZone {
  code?: string;
  offset?: string;
}
