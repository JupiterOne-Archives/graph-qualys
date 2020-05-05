import { PossibleArray, ISODateString } from '../../types';

export type QualysVulnerabilitiesErrorResponse = {
  "SIMPLE_RETURN": {
    "RESPONSE": {
      "DATETIME": ISODateString,
      "CODE": number,
      "TEXT": string;
    }
  }
};

export type ListQualysVulnerabilitiesReply = {
  KNOWLEDGE_BASE_VULN_LIST_OUTPUT?: KnowledgeBaseVulnListOutput;
};

export interface KnowledgeBaseVulnListOutput {
  RESPONSE?: Response;
}

export interface Response {
  VULN_LIST?: VulnList;
}

export interface VulnList {
  VULN?: Vuln;
}

export interface Vuln {
  QID?: number;
  VULN_TYPE?: string;
  SEVERITY_LEVEL?: number;
  TITLE?: string;
  CATEGORY?: string;
  LAST_SERVICE_MODIFICATION_DATETIME?: ISODateString;
  PUBLISHED_DATETIME?: ISODateString;
  BUGTRAQ_LIST?: BugtraqList;
  PATCHABLE?: number;
  VENDOR_REFERENCE_LIST?: VendorReferenceList;
  CVE_LIST?: CveList;
  DIAGNOSIS?: string;
  CONSEQUENCE?: string;
  SOLUTION?: string;
  CORRELATION?: Correlation;
  CVSS?: Cvss;
  PCI_FLAG?: number;
  DISCOVERY?: Discovery;
}

export interface BugtraqList {
  BUGTRAQ?: PossibleArray<Bugtraq>;
}

export interface Bugtraq {
  ID?: string;
  URL?: string;
}

export interface Correlation {
  EXPLOITS?: Exploits;
  MALWARE?: Malware;
}

export interface Exploits {
  EXPLT_SRC?: PossibleArray<ExpltSrc>;
}

export interface ExpltSrc {
  SRC_NAME?: string;
  EXPLT_LIST?: ExpltList;
}

export interface ExpltList {
  EXPLT?: PossibleArray<EXPLTElement>;
}

export interface EXPLTElement {
  REF?: string;
  DESC?: string;
  LINK?: string;
}

export interface Malware {
  MW_SRC?: MwSrc;
}

export interface MwSrc {
  SRC_NAME?: string;
  MW_LIST?: MwList;
}

export interface MwList {
  MW_INFO?: PossibleArray<MwInfo>;
}

export interface MwInfo {
  MW_ID?: string;
  MW_TYPE?: string;
  MW_PLATFORM?: string;
  MW_RATING?: string;
  MW_LINK?: string;
}

export interface CveList {
  CVE?: PossibleArray<Bugtraq>;
}

export interface Cvss {
  BASE?: number;
  TEMPORAL?: number;
  ACCESS?: Access;
  IMPACT?: Impact;
  AUTHENTICATION?: number;
  EXPLOITABILITY?: number;
  REMEDIATION_LEVEL?: number;
  REPORT_CONFIDENCE?: number;
}

export interface Access {
  VECTOR?: number;
  COMPLEXITY?: number;
}

export interface Impact {
  CONFIDENTIALITY?: number;
  INTEGRITY?: number;
  AVAILABILITY?: number;
}

export interface Discovery {
  REMOTE?: number;
  AUTH_TYPE_LIST?: AuthTypeList;
}

export interface AuthTypeList {
  AUTH_TYPE?: PossibleArray<string>;
}

export interface VendorReferenceList {
  VENDOR_REFERENCE?: Bugtraq;
}
