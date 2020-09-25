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
  ServiceResponse?: ServiceResponse;
}

export interface ServiceResponse {
  responseCode?: string;
  count?: number;
  hasMoreRecords?: boolean;
  data?: Data;
}

export interface Data {
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
