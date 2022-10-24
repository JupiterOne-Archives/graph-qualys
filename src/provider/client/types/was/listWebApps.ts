import { ServiceResponseBody } from '../qps';
import { ISODateString, PossibleArray } from '../util';

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
  | 'lastScan.date'
  | 'webApp.id'
  | 'format';

export type ListWebAppsFilters = Partial<
  Record<
    ListWebAppsFilterInputParameter,
    string | string[] | boolean | number | number[]
  >
>;

export type ListWebAppsPagination = { limit: number; offset?: number };

export type ListWebAppsResponse = ServiceResponseBody<WebAppData>;

export type WebAppData = {
  WebApp?: PossibleArray<WebApp>;
};

export type WebApp = {
  id?: number;
  name?: string;
  url?: string;
  owner?: Owner;
  tags?: Tags;
  createdDate?: ISODateString;
  updatedDate?: ISODateString;
};

export type Owner = {
  id?: number;
};

export type Tags = {
  count?: number;
};
