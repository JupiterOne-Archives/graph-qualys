import { Entity } from '@jupiterone/integration-sdk';

export interface QualysVulnerabilityEntity extends Entity {
  _type: 'qualys_vuln';
  _class: 'Vulnerability';
  _key: string;
  displayName: string;
  qid: number;
  name: string | undefined;
  category: string;
  severity: string;
  numericSeverity: number;
  webLink: string;
  blocking: boolean;
  open: boolean;
  production: boolean;
  public: boolean;
  patchable: boolean;
  cvssV2: number | undefined;
  // cvssV3: convertCvssStringToFloat(vuln.CVSSV3),
  remote: boolean;
  bugTraqWebLink: string[];
  vendorReferenceWebLink: string[];
  cveWebLink: string[];
  bugTraqId: string[];
  vendorReferenceId: string[];
  cveId: string[];
}

export interface WebAppEntity extends Entity {
  _type: 'qualys_web_app';
  _class: 'Application';
  _key: string;
  displayName: string;
  createdOn: number | undefined;
  updatedOn: number | undefined;
  name: string;
}

export interface WebAppFindingEntity extends Entity {
  _type: 'qualys_web_app_finding';
  _key: string;
  _class: 'Finding';
  displayName: string;
  name: string;
  qid: number;
  title: string | undefined;
  uri: string | undefined;
  param: string | undefined;
  category: string;
  open: boolean;
  severity: string;

  // TODO: These are required but not sure what values to use
  production: boolean;
  public: boolean;
}

export interface HostEntity extends Entity {
  _type: 'qualys_host';
  _key: string;
  _class: 'Host';
  name: string;
  hostname: string;
  hostId: number;
  assetId: number | undefined;
  fqdn: string | undefined;
  os: string | undefined;
  platform: string | undefined;
  lastScannedOn: number | undefined;
}

export interface HostFindingEntity extends Entity {
  _type: 'qualys_host_finding';
  _key: string;
  _class: 'Finding';
  displayName: string;
  name: string;
  qid: number;
  type: string | undefined;
  severity: string;
  numericSeverity: number;
  firstFoundOn: number | undefined;
  lastFoundOn: number | undefined;
  lastProcessedOn: number | undefined;
  lastTestedOn: number | undefined;
  lastUpdatedOn: number | undefined;
  numTimesFound: number | undefined;
  isDisabled: number | undefined;
  port: number | undefined;
  protocol: string | undefined;
  ssl: number | undefined;
  status: string | undefined;
  isIgnored: number | undefined;
  category: 'system-scan';
  open: boolean;

  // TODO: These are required but not sure what values to use
  production: boolean;
  public: boolean;
}
