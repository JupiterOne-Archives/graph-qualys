import {
  convertProperties,
  createDirectRelationship,
  createIntegrationEntity,
  createMappedRelationship,
  Entity,
  generateRelationshipType,
  IntegrationStep,
  IntegrationStepExecutionContext,
  parseTimePropertyValue,
  Relationship,
  RelationshipClass,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core';

import {
  buildKey,
  convertNumericSeverityToString,
  determinePlatform,
  TYPE_QUALYS_HOST_FINDING,
  TYPE_QUALYS_HOST_FINDING_AWS_INSTANCE_RELATIONSHIP,
  TYPE_QUALYS_HOST_FINDING_DISCOVERED_HOST_RELATIONSHIP,
  TYPE_QUALYS_SERVICE,
} from '../converters';
import { createQualysAPIClient } from '../provider';
import { assets, vmpc } from '../provider/client';
import { QualysIntegrationConfig } from '../types';
import { DATA_VMDR_SERVICE_ENTITY, STEP_FETCH_SERVICES } from './services';

const DATA_HOST_ASSET_IDS = 'DATA_HOST_ASSET_IDS';

/**
 * Fetches the set of host IDs that will be processed by the integration. This
 * step may be changed to reduce the set of processed hosts.
 */
export async function fetchHostIds({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);
  const hostIds = await apiClient.fetchHostIds();
  await jobState.setData(DATA_HOST_ASSET_IDS, hostIds);

  // `query` reflects parameters used to limit the set of hosts processed by the
  // integration. A value of `'all'` means no filters were used so that all
  // hosts are processed.
  logger.info({ hostIds: hostIds.length, filter: 'all' }, 'Host IDs collected');
}

export async function fetchHostDetections({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);
  const serviceEntity = (await jobState.getData(
    DATA_VMDR_SERVICE_ENTITY,
  )) as Entity;
  const allHostIds = (await jobState.getData(DATA_HOST_ASSET_IDS)) as number[];

  // const hostChunks = chunk(allHostIds, 500);
  // for (const hostIds of hostChunks) {
  // const hostDetailsById: Map<number, assets.HostAsset> = new Map(
  //   (await apiClient.fetchHostAssets(hostIds)).map((asset) => [
  //     asset.id!,
  //     asset,
  //   ]),
  // );

  await apiClient.iterateHostDetections(
    allHostIds,
    async ({ host, detections }) => {
      const seenHostFindingEntityKeys = new Set<string>();

      for (const detection of detections) {
        const findingKey = buildKey({
          qid: detection.QID,
          port: detection.PORT,
          protocol: detection.PROTOCOL,
          ssl: detection.SSL,
          hostId: host.ID,
        });

        if (seenHostFindingEntityKeys.has(findingKey)) continue;

        const findingEntity = await jobState.addEntity(
          createHostFindingEntity(findingKey, host, detection),
        );

        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.IDENTIFIED,
            from: serviceEntity,
            to: findingEntity,
          }),
        );

        // const hostDetails = hostDetailsById[host.ID!];
        const hostDetails = await apiClient.fetchHostDetails(host.ID!);
        await jobState.addRelationship(
          createHostFindingRelationship(findingEntity, hostDetails),
        );
      }
    },
  );
  // }
}

/**
 * Create a Finding entity for a detection host.
 *
 * TODO: Add `targets` to Finding and stop creating mapped relationship,
 * allowing global mappings to do their thing.
 *
 * @param key the Finding entity _key value
 * @param host the Host for which a vulnerability was detected
 * @param detection the detection of a vulnerability
 */
function createHostFindingEntity(
  key: string,
  host: vmpc.DetectionHost,
  detection: vmpc.HostDetection,
): Entity {
  const findingDisplayName = `QID ${detection.QID}`;
  return createIntegrationEntity({
    entityData: {
      source: {
        host,
        detection,
      },
      assign: {
        _type: TYPE_QUALYS_HOST_FINDING,
        _key: key,
        _class: 'Finding',
        displayName: findingDisplayName,
        name: findingDisplayName,
        qid: detection.QID!,
        type: detection.TYPE,
        severity: convertNumericSeverityToString(detection.SEVERITY),
        numericSeverity: detection.SEVERITY!,
        firstFoundOn: parseTimePropertyValue(detection.FIRST_FOUND_DATETIME),
        lastFoundOn: parseTimePropertyValue(detection.LAST_FOUND_DATETIME),
        numTimesFound: detection.TIMES_FOUND,
        isDisabled: detection.IS_DISABLED,
        lastProcessedOn: parseTimePropertyValue(
          detection.LAST_PROCESSED_DATETIME,
        ),
        port: detection.PORT,
        protocol: detection.PROTOCOL,
        ssl: detection.SSL,
        status: detection.STATUS,
        lastTestedOn: parseTimePropertyValue(detection.LAST_TEST_DATETIME),
        lastUpdatedOn: parseTimePropertyValue(detection.LAST_UPDATE_DATETIME),
        isIgnored: detection.IS_IGNORED,

        category: 'system-scan',
        open: true,

        // TODO: These are required but not sure what values to use
        production: true,
        public: true,
      },
    },
  });
}

/**
 * Creates a mapped relationship from the Host entity to the Finding.
 *
 * The system-mapper observes values in certain Finding/Vulnerability properties
 * that match entities ingested by other integrations to build relationships,
 * defined based on state of `{Finding,Vulnerability}.open`:
 *
 * * `true` - mapped as `{Finding,Vulnerability} <- HAS - Entity`
 * * `false` - mapped as `{Finding,Vulnerability} <- HAD - Entity`
 *
 * Relationships are created when `{Finding,Vulnerability}.targets` includes:
 *
 * * `Host.{name, hostname, publicIpAddress, privateIpAddress}`
 * * `{CodeRepo,Project,Application}.name`
 * * `CodeRepo.fullName`
 * * `{aws_instance,aws_db_instance}.instanceId`
 *
 * That said, this integration creates mapped relationships itself.
 *
 * TODO: Stop creating these mapped relationships if `Finding.targets` can do
 * the job with global mappings.
 *
 * @param finding the Finding entity representing the detection of a
 * vulnerability
 * @param host the detection host details to build a propert mapping target
 */
function createHostFindingRelationship(
  finding: Entity,
  host: assets.HostAsset,
): Relationship {
  const awsInstanceId = getEC2InstanceId(host);
  if (awsInstanceId) {
    return createEC2HostFindingRelationship(finding, host, awsInstanceId);
  } else {
    return createDiscoveredHostFindingRelationship(finding, host);
  }
}

function createEC2HostFindingRelationship(
  finding: Entity,
  _host: assets.HostAsset,
  instanceId: string,
): Relationship {
  return createMappedRelationship({
    _class: RelationshipClass.HAS,
    _type: TYPE_QUALYS_HOST_FINDING_AWS_INSTANCE_RELATIONSHIP,
    _mapping: {
      relationshipDirection: RelationshipDirection.REVERSE,
      sourceEntityKey: finding._key,
      targetFilterKeys: [['_type', 'instanceId']],
      targetEntity: {
        _type: 'aws_instance',
        instanceId: instanceId,
      },
    },
  });
}

function createDiscoveredHostFindingRelationship(
  finding: Entity,
  host: assets.HostAsset,
): Relationship {
  const hostname = host.dnsHostName || host.fqdn;
  return createMappedRelationship({
    _class: RelationshipClass.HAS,
    _type: TYPE_QUALYS_HOST_FINDING_DISCOVERED_HOST_RELATIONSHIP,
    _mapping: {
      relationshipDirection: RelationshipDirection.REVERSE,
      sourceEntityKey: finding._key,
      targetFilterKeys: [
        ['_type', 'qualysHostId'],
        ['_type', 'hostname'],
      ],
      targetEntity: {
        ...convertProperties(host),
        _type: 'discovered_host',
        _class: 'Host',
        displayName: host.name || hostname,
        hostname,
        qualysHostId: host.id,
        fqdn: host.fqdn,
        os: host.os,
        platform: determinePlatform(host),
        lastScannedOn: parseTimePropertyValue(host.lastVulnScan),
      },
    },
  });
}

function getEC2InstanceId(hostAsset: assets.HostAsset): string | undefined {
  const ec2 = hostAsset.sourceInfo?.list?.Ec2AssetSourceSimple;
  if ('EC_2' === ec2?.type) {
    return ec2.instanceId;
  }
}

export const hostDetectionSteps: IntegrationStep<QualysIntegrationConfig>[] = [
  {
    id: 'fetch-host-ids',
    name: 'Fetch Hosts IDs',
    entities: [],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchHostIds,
  },
  {
    id: 'fetch-host-detections',
    name: 'Fetch Host Detections',
    entities: [
      {
        _type: TYPE_QUALYS_HOST_FINDING,
        _class: 'Finding',
        resourceName: 'Detection',
      },
    ],
    relationships: [
      {
        _type: generateRelationshipType(
          RelationshipClass.IDENTIFIED,
          TYPE_QUALYS_SERVICE,
          TYPE_QUALYS_HOST_FINDING,
        ),
        _class: RelationshipClass.IDENTIFIED,
        sourceType: TYPE_QUALYS_SERVICE,
        targetType: TYPE_QUALYS_HOST_FINDING,
      },
      {
        _type: TYPE_QUALYS_HOST_FINDING_DISCOVERED_HOST_RELATIONSHIP,
        _class: RelationshipClass.HAS,
        sourceType: TYPE_QUALYS_HOST_FINDING,
        targetType: 'discovered_host',
      },
      {
        _type: TYPE_QUALYS_HOST_FINDING_AWS_INSTANCE_RELATIONSHIP,
        _class: RelationshipClass.HAS,
        sourceType: TYPE_QUALYS_HOST_FINDING,
        targetType: 'aws_instance',
      },
    ],
    dependsOn: [STEP_FETCH_SERVICES, 'fetch-host-ids'],
    executionHandler: fetchHostDetections,
  },
];
