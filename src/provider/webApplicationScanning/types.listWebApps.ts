import { PossibleArray, ISODateString } from '../../types';

export interface ListWebAppsReply {
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
