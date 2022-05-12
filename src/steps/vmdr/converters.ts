import { uniq } from 'lodash';

import {
  assignTags,
  createIntegrationEntity,
  createMappedRelationship,
  Entity,
  generateRelationshipKey,
  isPublicIp,
  parseTimePropertyValue,
  Relationship,
  RelationshipClass,
  RelationshipDirection,
  TargetEntityProperties,
} from '@jupiterone/integration-sdk-core';

import { assets, vmpc } from '../../provider/client';
import { toStringArray } from '../../util';
import toArray from '../../util/toArray';
import {
  convertNumericSeverityToString,
  normalizeNumericSeverity,
} from '../utils';
import {
  ENTITY_TYPE_DISCOVERED_HOST,
  ENTITY_TYPE_EC2_HOST,
  ENTITY_TYPE_GCP_HOST,
  ENTITY_TYPE_HOST_FINDING,
  MAPPED_RELATIONSHIP_TYPE_VDMR_DISCOVERED_HOST,
  MAPPED_RELATIONSHIP_TYPE_VDMR_EC2_HOST,
  MAPPED_RELATIONSHIP_TYPE_VDMR_GCP_HOST,
} from './constants';
import { HostAssetTargets } from './types';

/**
 * Creates a mapped relationship between a Service and Host. This should not be
 * used when the target is known to be an EC2 Host.
 *
 * @see createServiceScansEC2HostAssetRelationship
 *
 * @param serviceEntity the Service that provides scanning of the host
 * @param host a HostAsset that is scanned by the Service
 */
export function createServiceScansDiscoveredHostAssetRelationship(
  serviceEntity: Entity,
  host: assets.HostAsset,
): Relationship {
  return createMappedRelationship({
    _class: RelationshipClass.SCANS,
    // TODO require _type https://github.com/JupiterOne/sdk/issues/347
    _type: MAPPED_RELATIONSHIP_TYPE_VDMR_DISCOVERED_HOST,
    _mapping: {
      sourceEntityKey: serviceEntity._key,
      relationshipDirection: RelationshipDirection.FORWARD,
      /**
       * The primary value of this mapped relationship is to contribute details
       * to the Host entity. The `targetFilterKeys` are designed to coordinate
       * with the integration's mapping rule that will:
       *
       * - Map Finding to Host using `qualysQwebHostId`
       * - `CREATE_OR_UPDATE` the Host before or after this mapped relationship
       *   is processed
       */
      targetFilterKeys: [['_class', 'qualysQwebHostId']],
      targetEntity: createDiscoveredHostAssetTargetEntity(host),
    },
  });
}

/**
 * Creates a mapped relationship between a Service and EC2 Host.
 *
 * The `targetEntity` is defined in a way to allow the mapper to relate to
 * existing EC2 Host entities and, when they don't already exist, allows the AWS
 * integration to adopt the placeholder entity.
 *
 * @see createServiceScansDiscoveredHostAssetRelationship
 *
 * @param serviceEntity the Service that provides scanning of the host
 * @param host a HostAsset that is scanned by the Service
 */
export function createServiceScansEC2HostAssetRelationship(
  serviceEntity: Entity,
  host: assets.HostAsset,
): Relationship {
  return createMappedRelationship({
    // Ensure unique key based on host identity, not EC2 ARN.
    _key: generateRelationshipKey(
      RelationshipClass.SCANS,
      serviceEntity,
      generateHostAssetKey(host),
    ),
    _class: RelationshipClass.SCANS,
    // TODO require _type https://github.com/JupiterOne/sdk/issues/347
    _type: MAPPED_RELATIONSHIP_TYPE_VDMR_EC2_HOST,
    _mapping: {
      sourceEntityKey: serviceEntity._key,
      relationshipDirection: RelationshipDirection.FORWARD,
      targetFilterKeys: [['_type', '_key']],
      targetEntity: createEC2HostAssetTargetEntity(host),
    },
  });
}

/**
 * Creates a mapped relationship between a Service and GCP Host.
 *
 * The `targetEntity` is defined in a way to allow the mapper to relate to
 * existing GCP Host entities and, when they don't already exist, allows the GCP
 * integration to adopt the placeholder entity.
 *
 * @see createServiceScansDiscoveredHostAssetRelationship
 *
 * @param serviceEntity the Service that provides scanning of the host
 * @param host a HostAsset that is scanned by the Service
 */
export function createServiceScansGCPHostAssetRelationship(
  serviceEntity: Entity,
  host: assets.HostAsset,
): Relationship {
  return createMappedRelationship({
    // Ensure unique key based on host identity, not GCP selfLink.
    _key: generateRelationshipKey(
      RelationshipClass.SCANS,
      serviceEntity,
      generateHostAssetKey(host),
    ),
    _class: RelationshipClass.SCANS,
    // TODO require _type https://github.com/JupiterOne/sdk/issues/347
    _type: MAPPED_RELATIONSHIP_TYPE_VDMR_GCP_HOST,
    _mapping: {
      sourceEntityKey: serviceEntity._key,
      relationshipDirection: RelationshipDirection.FORWARD,
      targetFilterKeys: [['_type', '_key']],
      targetEntity: createGCPHostAssetTargetEntity(host),
    },
  });
}

export function createDiscoveredHostAssetTargetEntity(
  hostAsset: assets.HostAsset,
) {
  const hostEntity: TargetEntityProperties = {
    _class: ['Host'],
    _type: ENTITY_TYPE_DISCOVERED_HOST,
    _key: generateHostAssetKey(hostAsset),
    id: toStringArray([hostAsset.id, hostAsset.qwebHostId]),
    ...getHostAssetDetails(hostAsset),
    ...getHostAssetIPAddresses(hostAsset),
  };

  assignTags(hostEntity, getHostAssetTags(hostAsset));

  return markInvalidTags(hostEntity);
}

export function createEC2HostAssetTargetEntity(hostAsset: assets.HostAsset) {
  const hostEntity: TargetEntityProperties = {
    _class: ['Host'],
    _type: ENTITY_TYPE_EC2_HOST,
    _key: getEC2HostAssetArn(hostAsset),
    ...getHostAssetDetails(hostAsset),
    ...getHostAssetIPAddresses(hostAsset),
    ...getEC2HostAssetDetails(hostAsset),
  };

  // Bug: https://github.com/JupiterOne/sdk/issues/460
  let allTags: string[] = [];

  assignTags(hostEntity, getHostAssetTags(hostAsset));
  if (Array.isArray(hostEntity.tags)) {
    allTags = hostEntity.tags as string[];
  }

  assignTags(hostEntity, getEC2HostAssetTags(hostAsset));
  if (Array.isArray(hostEntity.tags)) {
    allTags = [...allTags, ...(hostEntity.tags as string[])];
  }

  hostEntity.tags = uniq(allTags);

  return markInvalidTags(hostEntity);
}

export function createGCPHostAssetTargetEntity(hostAsset: assets.HostAsset) {
  const hostEntity: TargetEntityProperties = {
    _class: ['Host'],
    _type: ENTITY_TYPE_GCP_HOST,
    _key: getGCPHostAssetSelfLink(hostAsset),
    ...getHostAssetDetails(hostAsset),
    ...getHostAssetIPAddresses(hostAsset),
    ...getGCPHostAssetDetails(hostAsset),
  };

  // Bug: https://github.com/JupiterOne/sdk/issues/460
  let allTags: string[] = [];

  assignTags(hostEntity, getHostAssetTags(hostAsset));
  if (Array.isArray(hostEntity.tags)) {
    allTags = hostEntity.tags as string[];
  }

  assignTags(hostEntity, getGCPHostAssetTags(hostAsset));
  if (Array.isArray(hostEntity.tags)) {
    allTags = [...allTags, ...(hostEntity.tags as string[])];
  }

  hostEntity.tags = uniq(allTags);

  return markInvalidTags(hostEntity);
}

export function isTagsValid(properties: TargetEntityProperties): boolean {
  if (!properties.tags) return true;
  if (typeof properties.tags === 'string') return true;
  if (
    Array.isArray(properties.tags) &&
    properties.tags.find((e) => !['string', 'number'].includes(typeof e)) ===
      undefined
  ) {
    return true;
  }
  return false;
}

export function markInvalidTags(
  properties: TargetEntityProperties,
): TargetEntityProperties {
  if (isTagsValid(properties)) {
    return properties;
  } else {
    return {
      ...properties,
      tags: 'INVALID_TAGS',
    };
  }
}

/**
 * Create a Finding entity for a detection host. Relationships to Host entities
 * depend on global mappings that match `Finding.targets`.
 *
 * @param key the Finding entity _key value
 * @param host the Host for which a vulnerability was detected
 * @param detection the detection of a vulnerability
 * @param hostAssetTargets detection target information by host, collected from
 * the host asset API, which is not available in the detection data itself
 */
export function createHostFindingEntity({
  key,
  host,
  detection,
  detectionResults,
  hostAssetTargets,
}: {
  key: string;
  host: vmpc.DetectionHost;
  detection: vmpc.HostDetection;
  detectionResults: string | undefined;
  hostAssetTargets: HostAssetTargets | undefined;
}): Entity {
  const findingDisplayName = `QID ${detection.QID}`;

  return createIntegrationEntity({
    entityData: {
      // Do NOT include the host in every Finding, there will be a relationship to it.
      // Esp. avoid storing the DETECTION_LIST by accident, it will exhaust disk storage.
      // source: detection, // TODO fix data uploads to support gzipped, large raw data
      source: {},
      assign: {
        _type: ENTITY_TYPE_HOST_FINDING,
        _key: key,
        _class: 'Finding',

        id: key,
        ec2InstanceArn: hostAssetTargets?.ec2InstanceArn,
        awsAccountId: hostAssetTargets?.awsAccountId,
        gcpInstanceSelfLink: hostAssetTargets?.gcpInstanceSelfLink,
        gcpProjectId: hostAssetTargets?.gcpProjectId,
        fqdn: hostAssetTargets?.fqdn,
        hostId: host.ID, // (QWebHostId) Used to map to Host.qualysAssetId (streamed mapping)

        displayName: findingDisplayName,
        name: findingDisplayName,
        qid: detection.QID!,
        type: detection.TYPE,

        // Limit storage to 300 bytes. Detection results can be many megabytes.
        details: detectionResults?.substring(0, 300),

        severity: convertNumericSeverityToString(detection.SEVERITY),
        numericSeverity: normalizeNumericSeverity(detection.SEVERITY),
        qualysSeverity: detection.SEVERITY,

        numTimesFound: detection.TIMES_FOUND,
        isDisabled: detection.IS_DISABLED,

        // Use found dates, same as web app findings
        createdOn: parseTimePropertyValue(detection.FIRST_FOUND_DATETIME),
        updatedOn: parseTimePropertyValue(detection.LAST_FOUND_DATETIME),

        firstFoundOn: parseTimePropertyValue(detection.FIRST_FOUND_DATETIME),
        lastFoundOn: parseTimePropertyValue(detection.LAST_FOUND_DATETIME),
        lastProcessedOn: parseTimePropertyValue(
          detection.LAST_PROCESSED_DATETIME,
        ),
        lastTestedOn: parseTimePropertyValue(detection.LAST_TEST_DATETIME),
        lastUpdatedOn: parseTimePropertyValue(detection.LAST_UPDATE_DATETIME),

        port: detection.PORT,
        protocol: detection.PROTOCOL,
        ssl: detection.SSL,
        status: detection.STATUS,
        isIgnored: detection.IS_IGNORED,

        category: 'system-scan',

        // See comments in `instanceConfigFields.ts`, `vmdrFindingStatuses`
        open: !detection.STATUS || !/fixed/i.test(detection.STATUS),

        // Not used by global mappings for this integration, added here for
        // consistency with Finding schema.
        targets: getDetectionHostTargets(host, hostAssetTargets),

        // TODO: These are required but not sure what values to use
        production: true,
        public: true,
      },
    },
  });
}

/**
 * Answers `Finding.targets` values for the `DetectionHost` reflecting the
 * values used in the integration's rules for mapping the Finding to Host and a
 * few more for completeness in the entity.
 *
 * This integration does NOT rely on the global mapping rules. It provides its
 * own rules designed to reduce load on the mapping system by limiting the
 * mapping to conditions known to exist in this integration's data.
 *
 * - Finding.fqdn === Host.fqdn
 * - Finding.ec2InstanceArn === Host._key && Host._type === aws_instance
 *
 * @param host the host associated with a vulnerability detection
 * @param hostAssetTargets additional targets collected from the corresponding
 * `HostAsset`
 */
export function getDetectionHostTargets(
  host: vmpc.DetectionHost,
  hostAssetTargets: HostAssetTargets | undefined,
): string[] {
  return toStringArray([
    host.IP,
    host.ID,
    hostAssetTargets?.fqdn,
    hostAssetTargets?.ec2InstanceArn,
    hostAssetTargets?.gcpInstanceSelfLink,
  ]);
}

/**
 * Answers `HostAssetTargets` for the `HostAsset`. These values are not
 * available on the detection host data and so must be captured from the asset
 * data. `fqdn` is normalized with `toLowerCase()`.
 *
 * @param host an Asset Manager host
 */
export function getHostAssetTargets(host: assets.HostAsset): HostAssetTargets {
  return {
    fqdn: getHostAssetFqdn(host),
    ec2InstanceArn: getEC2HostAssetArn(host),
    awsAccountId: getEC2HostAccountId(host),
    gcpInstanceSelfLink: getGCPHostAssetSelfLink(host),
    gcpProjectId: getGCPHostProjectId(host),
  };
}

export function getHostAssetFqdn(host: assets.HostAsset): string | undefined {
  let fqdn = safeLowerCase(host.dnsHostName);
  if (!fqdn || fqdn === '') {
    fqdn = safeLowerCase(host.fqdn);
  }
  if (!fqdn || fqdn === '') {
    fqdn = undefined;
  }
  return fqdn;
}

export function getHostAssetTags(hostAsset: assets.HostAsset): string[] {
  const tags: string[] = [];

  const simpleTagList = toArray(hostAsset.tags?.list?.TagSimple);
  simpleTagList
    ?.filter((e) => typeof e.name === 'string')
    .forEach((e) => tags.push(e.name));

  const oldTagList = toArray(hostAsset.tags?.TAG);
  oldTagList
    ?.filter((e) => typeof e.NAME === 'string')
    .forEach((e) => tags.push(e.NAME));

  return uniq(tags);
}

function getEC2HostAssetSource(hostAsset: assets.HostAsset) {
  return hostAsset.sourceInfo?.list?.Ec2AssetSourceSimple;
}

/**
 * AWS Account IDs are 12 characters long. If they are less than 12,
 * they should be padded with leading 0's as they were likely stripped
 * by the XML parser
 */
function getValidAWSAccountId(accountId: number) {
  return accountId.toString().padStart(12, '0');
}

export function getEC2HostAssetArn(
  hostAsset: assets.HostAsset,
): string | undefined {
  const ec2 = getEC2HostAssetSource(hostAsset);
  if (ec2?.region && ec2.accountId && ec2.instanceId) {
    return `arn:aws:ec2:${ec2.region}:${getValidAWSAccountId(
      ec2.accountId,
    )}:instance/${ec2.instanceId}`;
  }
}

export function getEC2HostAccountId(hostAsset: assets.HostAsset) {
  const ec2 = getEC2HostAssetSource(hostAsset);
  return ec2?.accountId === undefined
    ? undefined
    : getValidAWSAccountId(ec2.accountId);
}

export function getEC2HostAssetTags(
  hostAsset: assets.HostAsset,
): { key: string; value: string }[] | undefined {
  const ec2 = hostAsset.sourceInfo?.list?.Ec2AssetSourceSimple;
  const tags = toArray(ec2?.ec2InstanceTags?.tags?.list?.EC2Tags);
  return tags
    .filter((e) => typeof e.key === 'string' && typeof e.value !== 'object')
    .map((e) => ({ key: e.key, value: String(e.value) }));
}

export function getEC2HostAssetDetails(
  hostAsset: assets.HostAsset,
): object | undefined {
  const ec2 = hostAsset.sourceInfo?.list?.Ec2AssetSourceSimple;
  if (!ec2) return undefined;

  return {
    qualysFirstDiscoveredOn: parseTimePropertyValue(ec2.firstDiscovered),
    qualysLastUpdatedOn: parseTimePropertyValue(ec2.lastUpdated),

    id: ec2.instanceId,
    instanceId: ec2.instanceId,
    accountId: ec2.accountId ? getValidAWSAccountId(ec2.accountId) : undefined,
    region: ec2.region,
    state: ec2.instanceState?.toLowerCase(),
    reservationId: ec2.reservationId,
    availabilityZone: ec2.availabilityZone,
    subnetId: ec2.subnetId,
    vpcId: ec2.vpcId,
    instanceType: ec2.instanceType,
    imageId: ec2.imageId,
    privateDnsName: ec2.privateDnsName,
    privateIpAddress: ec2.privateIpAddress,
    publicDnsName: ec2.publicDnsName,
    publicIpAddress: ec2.publicIpAddress,
  };
}

function getGCPHostAssetSource(hostAsset: assets.HostAsset) {
  return hostAsset.sourceInfo?.list?.GcpAssetSourceSimple;
}

export function getGCPHostAssetSelfLink(
  hostAsset: assets.HostAsset,
): string | undefined {
  const gcp = getGCPHostAssetSource(hostAsset);
  if (gcp?.projectId && gcp?.zone && hostAsset?.name) {
    return `https://www.googleapis.com/compute/v1/projects/${gcp.projectId}/zones/${gcp.zone}/instances/${hostAsset?.name}`;
  }
}

export function getGCPHostProjectId(hostAsset: assets.HostAsset) {
  const gcp = getGCPHostAssetSource(hostAsset);
  return gcp?.projectId;
}

export function getGCPHostAssetTags(
  hostAsset: assets.HostAsset,
): { key: string; value: string }[] | undefined {
  const gcp = hostAsset.sourceInfo?.list?.GcpAssetSourceSimple;
  const tags = toArray(gcp?.gcpInstanceTags?.tags?.list?.GCPTags);
  return tags
    .filter((e) => typeof e.key === 'string' && typeof e.value !== 'object')
    .map((e) => ({ key: e.key, value: String(e.value) }));
}

export function getGCPHostAssetDetails(
  hostAsset: assets.HostAsset,
): object | undefined {
  const gcp = hostAsset.sourceInfo?.list?.GcpAssetSourceSimple;
  if (!gcp) return undefined;

  return {
    id: gcp.instanceId?.toString(),
    instanceName: hostAsset.name,
    qualysFirstDiscoveredOn: parseTimePropertyValue(gcp.firstDiscovered),
    qualysLastUpdatedOn: parseTimePropertyValue(gcp.lastUpdated),
    ...gcp,
    gcpInstanceTags: undefined, // Exclude this as it gets properly added to the entity later
  };
}

/**
 * Answers properties to assign to `Host` entities representing a `HostAsset`.
 *
 * @param host an Asset Manager host
 */
export function getHostAssetDetails(host: assets.HostAsset) {
  const hostname =
    host.hostname || getHostAssetFqdn(host) || host.address || String(host.id!);
  const fqdn = getHostAssetFqdn(host);
  const os = typeof host.os === 'string' ? host.os : undefined;
  const platform = os && determinePlatform(os);

  return {
    hostname,
    fqdn,
    os,
    platform,

    qualysAssetId: host.id,
    qualysQwebHostId: host.qwebHostId, // Used as target filter for Service|Finding -> Host

    qualysCreatedOn: parseTimePropertyValue(host.created),

    scannedBy: 'qualys',
    lastScannedOn: parseTimePropertyValue(host.lastVulnScan),

    name: host.name || hostname,
    displayName: host.name || hostname,
  };
}

/**
 * Generates a _key value for a host asset.
 *
 * This does not consider the POD the integration is ingesting data from, which
 * may become important if a customer ingests data from two Qualys subscriptions
 * that are not in the same POD. The ID documentation tells us the values can be
 * the same for two different hosts from two PODS because the values are no
 * globally unique.
 *
 * @see https://success.qualys.com/discussions/s/article/000006216
 */
function generateHostAssetKey(host: assets.HostAsset): string {
  return `Host:${host.qwebHostId!}`; // Finding -> discovered host streamed mapping is expecting QWebHostId
}

function getHostAssetIPAddresses(host: assets.HostAsset) {
  return {
    ipAddress: host.address,
    publicIpAddress:
      host.address && isPublicIp(host.address) ? host.address : undefined,
    privateIpAddress:
      host.address && !isPublicIp(host.address) ? host.address : undefined,
  };
}

function determinePlatform(os: string): string | undefined {
  // https://github.com/JupiterOne/graph-qualys/issues/101
  const lowerOs = safeLowerCase(os);

  if (lowerOs?.indexOf('linux') !== -1) {
    return 'linux';
  }

  if (lowerOs?.indexOf('windows') !== -1) {
    return 'windows';
  }
}

// Somehow, the values passed to this function may not have a `toLowerCase` function.
function safeLowerCase(value: string | undefined): string | undefined {
  if (value) {
    if (typeof value.toLowerCase === 'function') {
      return value.toLowerCase();
    } else if (typeof value !== 'object') {
      return String(value);
    }
  }
}
