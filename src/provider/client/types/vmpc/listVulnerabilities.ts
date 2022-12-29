import { QualyNumericSeverity } from '../../../../types';
import { QWebHostId } from '../index';
import { PossibleArray } from '../util';

// https://qualysapi.qualys.com/api/2.0/fo/knowledge_base/vuln/knowledge_base_vuln_list_output.dtd
export type ListQualysVulnerabilitiesResponse = {
  KNOWLEDGE_BASE_VULN_LIST_OUTPUT?: KnowledgeBaseVulnListOutput;
};

export type KnowledgeBaseVulnListOutput = {
  RESPONSE?: Response;
};

export type Response = {
  VULN_LIST?: VulnList;
};

export type VulnList = {
  VULN?: Vuln;
};

export type Vuln = {
  QID?: QWebHostId;
  VULN_TYPE?: string;
  SOLUTION?: string;
  DIAGNOSIS?: string;
  CONSEQUENCE?: string;
  CATEGORY?: string;
  DISCOVERY?: QualysDiscovery;
  SEVERITY_LEVEL?: QualyNumericSeverity;
  TITLE?: string;
  CVE_LIST?: CveList;
  CVSS?: Cvss;
  CVSS_V3?: CvssV3;
};

export type BugtraqList = {
  BUGTRAQ?: PossibleArray<Bugtraq>;
};

export type Bugtraq = {
  ID?: string;
  URL?: string;
};

export type Correlation = {
  EXPLOITS?: Exploits;
  MALWARE?: Malware;
};

export type Exploits = {
  EXPLT_SRC?: PossibleArray<ExpltSrc>;
};

export type ExpltSrc = {
  SRC_NAME?: string;
  EXPLT_LIST?: ExpltList;
};

export type ExpltList = {
  EXPLT?: PossibleArray<EXPLTElement>;
};

export type EXPLTElement = {
  REF?: string;
  DESC?: string;
  LINK?: string;
};

export type Malware = {
  MW_SRC?: MwSrc;
};

export type MwSrc = {
  SRC_NAME?: string;
  MW_LIST?: MwList;
};

export type MwList = {
  MW_INFO?: PossibleArray<MwInfo>;
};

export type MwInfo = {
  MW_ID?: string;
  MW_TYPE?: string;
  MW_PLATFORM?: string;
  MW_RATING?: string;
  MW_LINK?: string;
};

export type CveList = {
  CVE?: PossibleArray<Bugtraq>;
};

export type Cvss = {
  BASE?: number;
};

export type CvssV3 = {
  BASE?: number;
};

export type Access = {
  VECTOR?: number;
  COMPLEXITY?: number;
};

export type Impact = {
  CONFIDENTIALITY?: number;
  INTEGRITY?: number;
  AVAILABILITY?: number;
};

export type Discovery = {
  REMOTE?: number;
  AUTH_TYPE_LIST?: AuthTypeList;
};

export type AuthTypeList = {
  AUTH_TYPE?: PossibleArray<string>;
};

export type VendorReferenceList = {
  VENDOR_REFERENCE?: Bugtraq;
};

export type QualysDiscovery = {
  REMOTE?: number;
};
