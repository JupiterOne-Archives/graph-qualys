// https://www.qualys.com/docs/qualys-api-vmpc-user-guide.pdf
// /api/2.0/fo/asset/host/

import { ISODateString, PossibleArray } from '..';

// Not a complete list
type ListScannedHostIdsFilterInputParameter = 'vm_scan_since'; // YYYY-MM-DD[THH:MM:SSZ] (UTC/GMT)

export type ListScannedHostIdsFilters = Partial<
  Record<ListScannedHostIdsFilterInputParameter, string | boolean | number>
>;

export type ListScannedHostIdsPagination = { limit: number };

export type ListScannedHostIdsResponse = {
  HOST_LIST_OUTPUT?: ListScannedHostOutput;
};

type ListScannedHostOutput = {
  RESPONSE?: ListScannedHostResponse;
};

type ListScannedHostResponse = {
  DATETIME?: ISODateString;
  HOST_LIST?: ScannedHostList;
  ID_SET?: IDSet;
  WARNING?: {
    URL?: string;
  };
};

type ScannedHostList = {
  HOST?: PossibleArray<ScannedHost>;
};

type ScannedHost = {
  ID?: number;
};

type IDSet = {
  ID?: PossibleArray<number>;
};
