import {
  createIntegrationEntity,
  createMappedRelationship,
  Entity,
  generateRelationshipKey,
  isPublicIp,
  parseTimePropertyValue,
  Relationship,
  RelationshipClass,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core';

import { assets, vmpc } from '../../provider/client';
import { toStringArray } from '../../util';
import {
  convertNumericSeverityToString,
  normalizeNumericSeverity,
} from '../utils';
import {
  ENTITY_TYPE_DISCOVERED_HOST,
  ENTITY_TYPE_EC2_HOST,
  ENTITY_TYPE_HOST_FINDING,
  MAPPED_RELATIONSHIP_TYPE_VDMR_DISCOVERED_HOST,
  MAPPED_RELATIONSHIP_TYPE_VDMR_EC2_HOST,
} from './constants';

/**
 * Creates a mapped relationship between a Service and Host. This should not be
 * used when the target is known to be an EC2 Host.
 *
 * @see createServiceScansEC2HostRelationship
 *
 * @param serviceEntity the Service that provides scanning of the host
 * @param host a HostAsset that is scanned by the Service
 */
export function createServiceScansDiscoveredHostRelationship(
  serviceEntity: Entity,
  host: assets.HostAsset,
): Relationship {
  const hostname = getHostName(host);

  return createMappedRelationship({
    _class: RelationshipClass.SCANS,
    // TODO require _type https://github.com/JupiterOne/sdk/issues/347
    _type: MAPPED_RELATIONSHIP_TYPE_VDMR_DISCOVERED_HOST,
    _mapping: {
      sourceEntityKey: serviceEntity._key,
      relationshipDirection: RelationshipDirection.FORWARD,
      targetFilterKeys: [['_class', 'qualysAssetId']],
      targetEntity: {
        _class: 'Host',
        _type: ENTITY_TYPE_DISCOVERED_HOST,
        _key: generateHostAssetKey(host),

        // Add to the entity's `id` property values that this host is known as
        // in the Qualys system. These values are also added to the
        // `Finding.targets` to allow for global mappings of Findings to these
        // Host entities.
        id: toStringArray([host.id, host.qwebHostId]),
        qualysAssetId: host.id,
        qualysHostId: host.qwebHostId,

        scannedBy: 'qualys',
        lastScannedOn: parseTimePropertyValue(host.lastVulnScan),

        displayName: host.name || hostname,
        fqdn: host.fqdn,
        hostname,
        ...getHostIPAddresses(host),

        os: host.os,
        platform: determinePlatform(host),
      },
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
 * @param serviceEntity the Service that provides scanning of the host
 * @param host a HostAsset that is scanned by the Service
 */
export function createServiceScansEC2HostRelationship(
  serviceEntity: Entity,
  host: assets.HostAsset,
): Relationship {
  const hostname = getHostName(host);
  const instanceId = getEC2InstanceId(host);
  const instanceArn = getEC2HostArn(host);

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
      targetEntity: {
        _class: 'Host',
        _type: ENTITY_TYPE_EC2_HOST,
        _key: instanceArn,

        // This value is also added to the `Finding.targets` to allow for global
        // mappings of Findings to these Host entities.
        id: instanceId,
        qualysAssetId: host.id,
        qualysHostId: host.qwebHostId,

        scannedBy: 'qualys',
        lastScannedOn: parseTimePropertyValue(host.lastVulnScan),

        displayName: host.name || hostname,
        fqdn: host.fqdn,
        hostname,
        ...getHostIPAddresses(host),

        os: host.os,
        platform: determinePlatform(host),
      },
    },
  });
}

/**
 * Create a Finding entity for a detection host. Relationships to Host entities
 * depend on global mappings that match `Finding.targets`.
 *
 * @param key the Finding entity _key value
 * @param host the Host for which a vulnerability was detected
 * @param detection the detection of a vulnerability
 */
export function createHostFindingEntity(
  key: string,
  host: vmpc.DetectionHost,
  detection: vmpc.HostDetection,
  hostTargets: string[] | undefined,
): Entity {
  const findingDisplayName = `QID ${detection.QID}`;

  return createIntegrationEntity({
    entityData: {
      // Do NOT include the host in every Finding, there will be a relationship to it.
      // Esp. avoid storing the DETECTION_LIST by accident, it will exhaust disk storage.
      // source: detection, // TODO fix data uploads to support gzipped, large raw data
      source: {
        uploadStatus: 'SKIPPED',
        uploadStatusReason:
          'Raw data for detection entities currently disabled',
      },
      assign: {
        _type: ENTITY_TYPE_HOST_FINDING,
        _key: key,
        _class: 'Finding',

        displayName: findingDisplayName,
        name: findingDisplayName,
        qid: detection.QID!,
        type: detection.TYPE,

        severity: convertNumericSeverityToString(detection.SEVERITY),
        numericSeverity: normalizeNumericSeverity(detection.SEVERITY),

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

        targets: getTargetsForDetectionHost(host, hostTargets),

        // TODO: These are required but not sure what values to use
        production: true,
        public: true,
      },
    },
  });
}

/**
 * Answers `Finding.targets` values for the `DetectionHost`.
 *
 * * Host.id === host.ID
 * * Host.id === host.EC2_INSTANCE_ID
 * * Host.ipAddress === host.IP
 * * getTargetsFromHostAsset()
 *
 * These values are used in global mappings to relate the `Finding` to any
 * entity of `_class: 'Host'` that has a property matching one of these
 * `Finding.targets` values. The properties on the `Host` that will be matched
 * to `Finding.targets`:
 *
 * * `id`
 * * `name`
 * * `fqdn`
 * * `hostname`
 * * `address`,
 * * `ipAddress`
 * * `publicIpAddress`
 * * `privateIpAddress`
 *
 * Results may include additional values, though these may not be used in
 * building the relationship.
 *
 * @param host the host associated with a vulnerability detection
 * @param assetTargets additional targets collected from the corresponding `HostAsset`
 */
export function getTargetsForDetectionHost(
  host: vmpc.DetectionHost,
  assetTargets: string[] | undefined,
): string[] {
  const targets = new Set(
    toStringArray([host.ID, host.IP, host.EC2_INSTANCE_ID]),
  );
  if (assetTargets) {
    for (const target of assetTargets) {
      targets.add(target);
    }
  }
  return [...targets];
}

/**
 * Answers `Finding.targets` values for the `HostAsset`.
 *
 * * Host.id === host.id
 * * Host.id === getEC2InstanceId(host)
 * * Host.ipAddress === host.address
 * * Host.fqdn === host.dnsHostName
 * * Host.fqdn === host.fqdn
 *
 * @param host an Asset Manager host
 */
export function getTargetsFromHostAsset(host: assets.HostAsset): string[] {
  return toStringArray([
    host.id,
    host.address,
    host.dnsHostName,
    host.fqdn,
    getEC2InstanceId(host),
  ]);
}

export function getEC2HostArn(hostAsset: assets.HostAsset): string | undefined {
  const ec2 = hostAsset.sourceInfo?.list?.Ec2AssetSourceSimple;
  if ('EC_2' === ec2?.type && ec2.region && ec2.accountId && ec2.instanceId) {
    return `arn:aws:ec2:${ec2.region}:${ec2.accountId}:instance/${ec2.instanceId}`;
  }
}

function generateHostAssetKey(host: assets.HostAsset): string {
  return `qualys-host:${host.qwebHostId!}`;
}

function getEC2InstanceId(hostAsset: assets.HostAsset): string | undefined {
  const ec2 = hostAsset.sourceInfo?.list?.Ec2AssetSourceSimple;
  if ('EC_2' === ec2?.type) {
    return ec2.instanceId;
  }
}

function getHostName(host: assets.HostAsset): string {
  return host.dnsHostName || host.fqdn || host.address || String(host.id!);
}

function getHostIPAddresses(host: assets.HostAsset) {
  return {
    ipAddress: host.address,
    publicIpAddress:
      host.address && isPublicIp(host.address) ? host.address : undefined,
    privateIpAddress:
      host.address && !isPublicIp(host.address) ? host.address : undefined,
  };
}

function determinePlatform(hostAsset: assets.HostAsset): string | undefined {
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
