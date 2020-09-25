import { PossibleArray, ISODateString } from './util';

export interface ListHostDetectionsResponse {
  HOST_LIST_VM_DETECTION_OUTPUT?: ListHostDetectionOutput;
}

export interface ListHostDetectionOutput {
  RESPONSE?: ListHostDetectionResponse;
}

export interface ListHostDetectionResponse {
  DATETIME?: ISODateString;
  HOST_LIST?: DetectionHostList;
  WARNING?: {
    URL?: string;
  };
}

export interface DetectionHostList {
  HOST?: PossibleArray<DetectionHost>;
}

export interface DetectionHost {
  ID?: number;
  IP?: string;
  TRACKING_METHOD?: string;
  OS?: string;
  DNS?: string;
  LAST_SCAN_DATETIME?: ISODateString;
  LAST_VM_SCANNED_DATE?: ISODateString;
  LAST_VM_SCANNED_DURATION?: number;
  DETECTION_LIST?: HostDetectionList;
  NETBIOS?: string;
  QG_HOSTID?: string;
  LAST_VM_AUTH_SCANNED_DATE?: ISODateString;
  LAST_PC_SCANNED_DATE?: ISODateString;
}

export interface HostDetectionList {
  DETECTION?: PossibleArray<HostDetection>;
}

export interface HostDetection {
  QID?: number;
  TYPE?: HostDetectionType;
  SEVERITY?: number;
  RESULTS?: string;
  FIRST_FOUND_DATETIME?: ISODateString;
  LAST_FOUND_DATETIME?: ISODateString;
  TIMES_FOUND?: number;
  IS_DISABLED?: number;
  LAST_PROCESSED_DATETIME?: ISODateString;
  PORT?: number;
  PROTOCOL?: HostDetectionProtocol;
  SSL?: number;
  STATUS?: HostDetectionStatus;
  LAST_TEST_DATETIME?: ISODateString;
  LAST_UPDATE_DATETIME?: ISODateString;
  IS_IGNORED?: number;
}

export type HostDetectionProtocol = 'tcp' | string;
export type HostDetectionStatus = 'Active' | 'New' | string;
export type HostDetectionType = 'Confirmed' | 'Info' | string;
