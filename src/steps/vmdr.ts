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
  TYPE_QUALYS_SERVICE,
} from '../converters';
import { createQualysAPIClient } from '../provider';
import { assets, vmpc } from '../provider/client';
import { QualysIntegrationConfig } from '../types';
import { DATA_VMDR_SERVICE_ENTITY, STEP_FETCH_SERVICES } from './services';

const STEP_FETCH_SCANNED_HOST_IDS = 'fetch-scanned-host-ids';
const STEP_FETCH_SCANNED_HOST_DETAILS = 'fetch-scanned-host-details';
const STEP_FETCH_SCANNED_HOST_FINDINGS = 'fetch-scanned_host-detections';

const DATA_SCANNED_HOST_IDS = 'DATA_SCANNED_HOST_IDS';

/**
 * Fetches the set of scanned host IDs that will be processed by the
 * integration. This step may be changed to reduce the set of processed hosts.
 */
export async function fetchScannedHostIds({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);
  const hostIds = await apiClient.fetchScannedHostIds();
  await jobState.setData(DATA_SCANNED_HOST_IDS, hostIds);

  // `query` reflects parameters used to limit the set of hosts processed by the
  // integration. A value of `'all'` means no filters were used so that all
  // hosts are processed.
  logger.info(
    { numScannedHostIds: hostIds.length, filter: 'all' },
    'Scanned host IDs collected',
  );
}

/**
 * Fetches Host details and creates mapped relationships between the Service and
 * Host entities.
 *
 * Qualys does not own Host entities, it monitors them, so it is important to
 * allow the system mapper to connect the Service to existing Host entities.
 */
export async function fetchScannedHostDetails({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const hostIds = (await jobState.getData(DATA_SCANNED_HOST_IDS)) as number[];
  const vdmrServiceEntity = (await jobState.getData(
    DATA_VMDR_SERVICE_ENTITY,
  )) as Entity;

  const apiClient = createQualysAPIClient(logger, instance.config);

  await apiClient.iterateHostDetails(hostIds, async (host) => {
    const hostname = host.dnsHostName || host.fqdn;
    await jobState.addRelationship(
      createMappedRelationship({
        _class: RelationshipClass.MONITORS,
        _type: TYPE_QUALYS_SERVICE_HOST_RELATIONSHIP,
        _mapping: {
          sourceEntityKey: vdmrServiceEntity._key,
          relationshipDirection: RelationshipDirection.FORWARD,
          targetFilterKeys: [
            // Allow for mapping to AWS EC2 Host entities
            ['_class', 'instanceId'],
          ],
          targetEntity: {
            _class: 'Host',

            displayName: host.name || hostname,
            fqdn: host.fqdn,
            hostname,

            // Allow for mapping to EC2 Host entities
            instanceId: getEC2InstanceId(host),

            address: host.address,
            // privateIpAddress: TODO
            // publicIpAddress: TODO

            // Provide these to allow for Finding mapped relationships later.
            // These are expected to be transferred to existing target Host
            // entities.
            qualysAssetId: host.id,
            qualysHostId: host.qwebHostId,

            os: host.os,
            platform: determinePlatform(host),

            scannedBy: 'qualys',
            lastScannedOn: parseTimePropertyValue(host.lastVulnScan),
          },
        },
      }),
    );
  });
}

export async function fetchScannedHostFindings({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const hostIds = (await jobState.getData(DATA_SCANNED_HOST_IDS)) as number[];
  const serviceEntity = (await jobState.getData(
    DATA_VMDR_SERVICE_ENTITY,
  )) as Entity;

  const apiClient = createQualysAPIClient(logger, instance.config);

  await apiClient.iterateHostDetections(
    hostIds,
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

        seenHostFindingEntityKeys.add(findingKey);

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

        await jobState.addRelationship(
          createHostFindingRelationship(findingEntity, host),
        );
      }
    },
  );
  // }
}

/**
 * Create a Finding entity for a detection host.
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
        ...convertProperties(detection),

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

        // This is referenced in global mappings to relate the Finding to any
        // Host that has a property matching one of these values. The properties
        // on the Host are: `name`, `hostname`, `publicIpAddress`, `privateIpAddress`.
        // Additionally, when the Host has `_type: aws_instance|aws_db_instance`,
        // the `instanceId` property will be matched.
        targets: getTargetsFromDetectionHost(host),

        // TODO: These are required but not sure what values to use
        production: true,
        public: true,
      },
    },
  });
}

/**
 * Creates a mapped relationship of Finding <- HAS - Host. The Host entities are
 * expected to have been created already as part of mapping the Service -
 * MONITORS -> Host mapped relationship in a previous step.
 *
 * @param finding of a vulnerability on a host
 * @param host the host
 */
function createHostFindingRelationship(
  finding: Entity,
  host: vmpc.DetectionHost,
): Relationship {
  return createMappedRelationship({
    _class: RelationshipClass.HAS,
    _type: TYPE_QUALYS_FINDING_HOST_RELATIONSHIP,
    _mapping: {
      relationshipDirection: RelationshipDirection.REVERSE,
      sourceEntityKey: finding._key,
      targetFilterKeys: [['_class', 'qualysHostId']],
      targetEntity: {
        _class: 'Host',
        instanceId: host.EC2_INSTANCE_ID,
        qualysHostId: host.ID,
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

function getTargetsFromDetectionHost(host: vmpc.DetectionHost): string[] {
  const targets: string[] = [];

  [host.IP, host.EC2_INSTANCE_ID].forEach((e) => {
    if (e) {
      targets.push(e);
    }
  });

  return targets;
}

export const TYPE_QUALYS_SERVICE_HOST_RELATIONSHIP = `${TYPE_QUALYS_SERVICE}_has_host`;
export const TYPE_QUALYS_FINDING_HOST_RELATIONSHIP = `${TYPE_QUALYS_HOST_FINDING}_has_host`;

export const hostDetectionSteps: IntegrationStep<QualysIntegrationConfig>[] = [
  {
    id: STEP_FETCH_SCANNED_HOST_IDS,
    name: 'Fetch Scanned Host IDs',
    entities: [],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchScannedHostIds,
  },
  {
    id: STEP_FETCH_SCANNED_HOST_DETAILS,
    name: 'Fetch Scanned Host Details',
    entities: [],
    relationships: [
      {
        _type: TYPE_QUALYS_SERVICE_HOST_RELATIONSHIP,
        _class: RelationshipClass.MONITORS,
        sourceType: TYPE_QUALYS_SERVICE,
        targetType: '*_host',
      },
    ],
    dependsOn: [STEP_FETCH_SERVICES, STEP_FETCH_SCANNED_HOST_IDS],
    executionHandler: fetchScannedHostDetails,
  },
  {
    id: STEP_FETCH_SCANNED_HOST_FINDINGS,
    name: 'Fetch Scanned Host Findings',
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
        _type: TYPE_QUALYS_FINDING_HOST_RELATIONSHIP,
        _class: RelationshipClass.HAS,
        sourceType: TYPE_QUALYS_HOST_FINDING,
        targetType: '*host',
      },
    ],
    dependsOn: [STEP_FETCH_SCANNED_HOST_DETAILS],
    executionHandler: fetchScannedHostFindings,
  },
];
