import { createIntegrationEntity } from '@jupiterone/integration-sdk-core';

import * as listHostAssetsTypes from '../provider/assetManagement/types.listHostAssets';
import * as listQualysVulnerabilitiesTypes from '../provider/knowledgeBase/types.listQualysVulnerabilities';
import * as listHostDetectionsTypes from '../provider/vulnerabilityManagement/types.listHostDetections';
import * as fetchScanResultsTypes from '../provider/webApplicationScanning/types.fetchScanResults';
import * as listWebAppsTypes from '../provider/webApplicationScanning/types.listWebApps';
import { convertISODateStringToTimestamp } from '../util/converterUtl';
import toArray from '../util/toArray';
import {
  HostEntity,
  HostEntityEC2Metadata,
  HostFindingEntity,
  QualysVulnerabilityEntity,
  WebAppEntity,
  WebAppFindingEntity,
} from './types';

export function buildWebAppKey(options: { webAppId: number }): string {
  return `web_app:${options.webAppId.toString()}`;
}

export function buildQualysVulnKey(options: { qid: number }): string {
  return `vuln-qid:${options.qid}`;
}

export function buildHostKey(options: {
  // Use the _host_ ID and not the _host asset_ ID (there's a difference...)
  qwebHostId: number;
}): string {
  return `qualys-host:${options.qwebHostId}`;
}

export function buildKey(
  data: Record<string, string | boolean | number | undefined>,
): string {
  const keys = Object.keys(data);
  keys.sort();

  const parts: string[] = [];

  for (const key of keys) {
    const value = data[key];
    if (value != null) {
      parts.push(`${key}:${value}`);
    }
  }

  return parts.join('|');
}

export const TYPE_QUALYS_WEB_APP = 'qualys_web_app';
export const TYPE_QUALYS_WEB_APP_FINDING = 'qualys_web_app_finding';
export const TYPE_QUALYS_HOST = 'qualys_host';
export const TYPE_QUALYS_HOST_FINDING = 'qualys_host_finding';
export const TYPE_QUALYS_VULN = 'qualys_vuln';

const SEVERITY_MAPPINGS = ['none', 'info', 'low', 'medium', 'high', 'critical'];

export function convertNumericSeverityToString(
  numericSeverity: number | undefined,
): string {
  if (numericSeverity === undefined || numericSeverity < 0) {
    return 'unknown';
  }
  return numericSeverity <= 5 ? SEVERITY_MAPPINGS[numericSeverity] : 'critical';
}

export function determinePlatform(
  hostAsset: listHostAssetsTypes.HostAsset,
): string | undefined {
  let os = hostAsset.os;
  if (!os) {
    return undefined;
  }

  os = os.toLowerCase();

  if (os.indexOf('linux') !== -1) {
    return 'linux';
  }

  if (os.indexOf('windows') !== -1) {
    return 'windows';
  }
}

export function convertWebAppToEntity(options: {
  webApp: listWebAppsTypes.WebApp;
}): WebAppEntity {
  const { webApp } = options;
  const entity: WebAppEntity = {
    createdOn: convertISODateStringToTimestamp(webApp.createdDate),
    updatedOn: convertISODateStringToTimestamp(webApp.updatedDate),
    name: webApp.name!,
    _type: TYPE_QUALYS_WEB_APP,
    _key: buildWebAppKey({
      webAppId: webApp.id!,
    }),
    _class: 'Application',
    displayName: webApp.name!,
  };

  return (createIntegrationEntity({
    entityData: {
      source: {},
      assign: entity,
    },
  }) as unknown) as WebAppEntity;
}

export function convertWebAppVulnerabilityToFinding(options: {
  vuln: fetchScanResultsTypes.WasScanVuln;
  webApp: fetchScanResultsTypes.WebApp;
  vulnFromKnowledgeBase: QualysVulnerabilityEntity | undefined;
}): WebAppFindingEntity {
  const { vuln, webApp, vulnFromKnowledgeBase } = options;
  const findingKey = buildKey({
    qid: vuln.qid,
    uri: vuln.uri,
    param: vuln.param,
    title: vuln.title,
    webAppId: webApp.id,
  });

  const findingDisplayName = `${vuln.title} (QID ${vuln.qid})`;

  const entity: WebAppFindingEntity = {
    _type: TYPE_QUALYS_WEB_APP_FINDING,
    _key: findingKey,
    _class: 'Finding',
    displayName: findingDisplayName,
    name: findingDisplayName,
    qid: vuln.qid!,
    title: vuln.title,
    uri: vuln.uri,
    param: vuln.param,
    category: 'app-scan',
    open: true,
    severity: vulnFromKnowledgeBase?.severity ?? 'unknown',

    // TODO: These are required but not sure what values to use
    production: true,
    public: true,
  };

  return (createIntegrationEntity({
    entityData: {
      source: {
        instances: vuln.instances,
      },
      assign: entity,
    },
  }) as unknown) as WebAppFindingEntity;
}

export function convertQualysVulnerabilityToEntity(options: {
  vuln: listQualysVulnerabilitiesTypes.Vuln;
}): QualysVulnerabilityEntity {
  const { vuln } = options;
  const cveList = toArray(vuln.CVE_LIST?.CVE);
  const webLink = cveList[0]?.URL as string;

  const entity: QualysVulnerabilityEntity = {
    qid: vuln.QID!,
    name: vuln.TITLE,
    // TODO: Fix category
    category: 'application',
    severity: convertNumericSeverityToString(vuln.SEVERITY_LEVEL),
    numericSeverity: vuln.SEVERITY_LEVEL!,
    webLink,
    blocking: false,
    open: true,
    production: true,
    public: cveList.length > 0,
    patchable: vuln.PATCHABLE === 1,
    cvssV2: vuln.CVSS?.BASE,
    // cvssV3: convertCvssStringToFloat(vuln.CVSSV3),
    remote: vuln.DISCOVERY?.REMOTE !== 0,
    _class: 'Vulnerability',
    _type: TYPE_QUALYS_VULN,
    _key: buildQualysVulnKey({
      qid: vuln.QID!,
    }),
    displayName: vuln.TITLE!,
    bugTraqWebLink: toArray(vuln.BUGTRAQ_LIST?.BUGTRAQ).map((bugTraq) => {
      return bugTraq.URL!;
    }),
    vendorReferenceWebLink: toArray(
      vuln.VENDOR_REFERENCE_LIST?.VENDOR_REFERENCE,
    ).map((vendorReference) => {
      return vendorReference.URL!;
    }),
    cveWebLink: toArray(vuln.CVE_LIST?.CVE).map((cve) => {
      return cve.URL!;
    }),
    bugTraqId: toArray(vuln.BUGTRAQ_LIST?.BUGTRAQ).map((bugTraq) => {
      return bugTraq.ID!;
    }),
    vendorReferenceId: toArray(
      vuln.VENDOR_REFERENCE_LIST?.VENDOR_REFERENCE,
    ).map((vendorReference) => {
      return vendorReference.ID!;
    }),
    cveId: toArray(vuln.CVE_LIST?.CVE).map((cve) => {
      return cve.ID!;
    }),
  };

  return (createIntegrationEntity({
    entityData: {
      source: {
        diagnosis: vuln.DIAGNOSIS,
        consequence: vuln.CONSEQUENCE,
        solution: vuln.SOLUTION,
        correlation: vuln.CORRELATION,
      },
      assign: entity,
    },
  }) as unknown) as QualysVulnerabilityEntity;
}

export function convertHostAssetToEntity(options: {
  hostAsset: listHostAssetsTypes.HostAsset;
}): HostEntity {
  const { hostAsset } = options;
  const qwebHostId = hostAsset.qwebHostId!;
  const hostKey = buildHostKey({
    qwebHostId: qwebHostId,
  });

  const hostname = hostAsset.dnsHostName || hostAsset.fqdn;
  const hostEC2Metadata = hostAsset.sourceInfo?.list?.Ec2AssetSourceSimple;
  let hostEntityEC2Metadata: HostEntityEC2Metadata | undefined;

  if (hostEC2Metadata) {
    const { ec2InstanceTags, ...metadata } = hostEC2Metadata;
    hostEntityEC2Metadata = metadata;
  }

  const hostDetails: HostEntity = {
    _type: TYPE_QUALYS_HOST,
    _key: hostKey,
    _class: 'Host',
    displayName: hostAsset.name,
    name: hostAsset.name || hostname!,
    hostname: hostname!,
    hostId: qwebHostId,
    assetId: hostAsset.id!,
    fqdn: hostAsset.fqdn,
    os: hostAsset.os,
    platform: determinePlatform(hostAsset),
    lastScannedOn: convertISODateStringToTimestamp(hostAsset.lastVulnScan),
    ...hostEntityEC2Metadata,
  };

  return (createIntegrationEntity({
    entityData: {
      source: {},
      assign: {
        ...hostDetails,
        _type: TYPE_QUALYS_HOST,
        _key: hostKey,
        _class: 'Host',
        displayName: hostAsset.name,
      },
    },
  }) as unknown) as HostEntity;
}

export function isHostEC2Instance(hostEntity: HostEntity): boolean {
  return !!(hostEntity.type === 'EC_2' && hostEntity.instanceId);
}

export function convertHostToEntity(options: {
  host: listHostDetectionsTypes.Host;
}): HostEntity {
  const { host } = options;
  const hostId = host.ID!;
  const hostKey = buildHostKey({
    qwebHostId: hostId,
  });

  const hostname = host.DNS || host.NETBIOS || host.IP!;

  const entity: HostEntity = {
    name: hostname,
    hostname,
    hostId,
    os: host.OS,
    lastScannedOn: convertISODateStringToTimestamp(host.LAST_SCAN_DATETIME),
    _type: TYPE_QUALYS_HOST,
    _key: hostKey,
    _class: 'Host',
    displayName: hostname,
    assetId: undefined,
    fqdn: undefined,
    platform: undefined,
  };

  return (createIntegrationEntity({
    entityData: {
      source: {},
      assign: entity,
    },
  }) as unknown) as HostEntity;
}

export function convertHostDetectionToEntity(options: {
  detection: listHostDetectionsTypes.Detection;
  hostId: number;
  vulnFromKnowledgeBase: QualysVulnerabilityEntity | undefined;
}): HostFindingEntity {
  const { detection, vulnFromKnowledgeBase } = options;
  const findingKey = buildKey({
    qid: detection.QID,
    port: detection.PORT,
    protocol: detection.PROTOCOL,
    ssl: detection.SSL,
    hostId: options.hostId,
  });
  const findingDisplayName =
    vulnFromKnowledgeBase?.name || `QID ${detection.QID}`;
  const entity: HostFindingEntity = {
    _type: TYPE_QUALYS_HOST_FINDING,
    _key: findingKey,
    _class: 'Finding',
    displayName: findingDisplayName,
    name: findingDisplayName,
    qid: detection.QID!,
    type: detection.TYPE,
    severity: convertNumericSeverityToString(detection.SEVERITY),
    numericSeverity: detection.SEVERITY!,
    firstFoundOn: convertISODateStringToTimestamp(
      detection.FIRST_FOUND_DATETIME,
    ),
    lastFoundOn: convertISODateStringToTimestamp(detection.LAST_FOUND_DATETIME),
    numTimesFound: detection.TIMES_FOUND,
    isDisabled: detection.IS_DISABLED,
    lastProcessedOn: convertISODateStringToTimestamp(
      detection.LAST_PROCESSED_DATETIME,
    ),
    port: detection.PORT,
    protocol: detection.PROTOCOL,
    ssl: detection.SSL,
    status: detection.STATUS,
    lastTestedOn: convertISODateStringToTimestamp(detection.LAST_TEST_DATETIME),
    lastUpdatedOn: convertISODateStringToTimestamp(
      detection.LAST_UPDATE_DATETIME,
    ),
    isIgnored: detection.IS_IGNORED,

    category: 'system-scan',
    open: true,

    // TODO: These are required but not sure what values to use
    production: true,
    public: true,
  };
  return (createIntegrationEntity({
    entityData: {
      source: {
        results: detection.RESULTS,
      },
      assign: entity,
    },
  }) as unknown) as HostFindingEntity;
}
