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
  RelationshipClass,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core';

import {
  buildKey,
  convertNumericSeverityToString,
  determinePlatform,
  TYPE_QUALYS_HOST_FINDING,
  TYPE_QUALYS_SERVICE_VMDR,
} from '../converters';
import { createQualysAPIClient } from '../provider';
import { assets, vmpc } from '../provider/client';
import { QualysIntegrationConfig } from '../types';
import { DATA_VMDR_SERVICE_ENTITY, STEP_FETCH_SERVICES } from './services';

const STEP_FETCH_SCANNED_HOST_IDS = 'fetch-scanned-host-ids';
const STEP_FETCH_SCANNED_HOST_DETAILS = 'fetch-scanned-host-details';
const STEP_FETCH_SCANNED_HOST_FINDINGS = 'fetch-scanned_host-detections';

const DATA_SCANNED_HOST_IDS = 'DATA_SCANNED_HOST_IDS';
const DATA_HOST_TARGETS = 'DATA_HOST_TARGETS';

type HostTargetsMap = Record<number, string[]>;

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

  // Collect `targets` available on the `HostAsset`, some of which are not
  // available on the `DetectionHost`. Since the Host entities are only
  // maintained as `targetEntity` of a mapped relationship, it is not possible
  // to look them up otherwise in later steps.
  const hostTargets: HostTargetsMap = {};

  await apiClient.iterateHostDetails(hostIds, async (host) => {
    const hostname = host.dnsHostName || host.fqdn;
    const instanceId = getEC2InstanceId(host);

    await jobState.addRelationship(
      createMappedRelationship({
        _class: 'SCANS' as RelationshipClass, // TODO https://github.com/JupiterOne/data-model/pull/43
        // TODO require _type https://github.com/JupiterOne/sdk/issues/347
        _type: TYPE_QUALYS_VDMR_HOST_MAPPED_RELATIONSHIP,
        _mapping: {
          sourceEntityKey: vdmrServiceEntity._key,
          relationshipDirection: RelationshipDirection.FORWARD,
          targetFilterKeys: [['_class', 'instanceId']],
          targetEntity: {
            _class: 'Host',

            // TODO allow assignment of string[] values for id
            id: toStringArray([host.id, host.qwebHostId]) as any,
            qualysAssetId: host.id,
            qualysHostId: host.qwebHostId,

            displayName: host.name || hostname,
            fqdn: host.fqdn,
            hostname,
            ipAddress: host.address,

            instanceId,

            scannedBy: 'qualys',
            lastScannedOn: parseTimePropertyValue(host.lastVulnScan),

            os: host.os,
            platform: determinePlatform(host),
          },
        },
      }),
    );

    // Ensure that `DATA_HOST_TARGETS` is updated for each host so that should
    // a partial set be ingested, we don't lose what we've seen for later
    // steps.
    if (host.qwebHostId) {
      hostTargets[host.qwebHostId] = getTargetsFromHostAsset(host);
      await jobState.setData(DATA_HOST_TARGETS, hostTargets);
    } else {
      logger.info(
        { host: { id: host.id } },
        'Unable to store targets for host asset. This may affect global mappings.',
      );
    }
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

  const hostTargetsMap = (await jobState.getData(
    DATA_HOST_TARGETS,
  )) as HostTargetsMap;

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
          createHostFindingEntity(
            findingKey,
            host,
            detection,
            hostTargetsMap[host.ID!],
          ),
        );

        await jobState.addRelationship(
          createDirectRelationship({
            _class: RelationshipClass.IDENTIFIED,
            from: serviceEntity,
            to: findingEntity,
          }),
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
  hostTargets: string[] | undefined,
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

        targets: getTargetsForDetectionHost(host, hostTargets),

        // TODO: These are required but not sure what values to use
        production: true,
        public: true,
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
function getTargetsForDetectionHost(
  host: vmpc.DetectionHost,
  assetTargets: string[] | undefined,
): string[] {
  const targets = new Set(
    toStringArray([host.ID, host.IP, host.EC2_INSTANCE_ID]),
  );
  if (assetTargets) assetTargets.forEach(targets.add);
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
function getTargetsFromHostAsset(host: assets.HostAsset): string[] {
  return toStringArray([
    host.id,
    host.address,
    host.dnsHostName,
    host.fqdn,
    getEC2InstanceId(host),
  ]);
}

function toStringArray(values: (string | number | undefined)[]): string[] {
  const strings: string[] = [];
  values.forEach((e) => {
    if (e) {
      strings.push(String(e));
    }
  });
  return strings;
}

export const TYPE_QUALYS_VDMR_HOST_MAPPED_RELATIONSHIP = `${TYPE_QUALYS_SERVICE_VMDR}_scans_host`;

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
        _type: TYPE_QUALYS_VDMR_HOST_MAPPED_RELATIONSHIP,
        _class: 'SCANS' as RelationshipClass, // TODO https://github.com/JupiterOne/data-model/pull/43
        sourceType: TYPE_QUALYS_SERVICE_VMDR,
        targetType: 'Host', // TODO what should this be for a mapped relationship
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
          TYPE_QUALYS_SERVICE_VMDR,
          TYPE_QUALYS_HOST_FINDING,
        ),
        _class: RelationshipClass.IDENTIFIED,
        sourceType: TYPE_QUALYS_SERVICE_VMDR,
        targetType: TYPE_QUALYS_HOST_FINDING,
      },

      // Global mappings will do the work of building a relationship between the
      // `Finding` and `Host` entities. It depends on the `Finding.targets`
      // containing a value that matches certain properties on the `Host`.
    ],
    dependsOn: [STEP_FETCH_SCANNED_HOST_DETAILS],
    executionHandler: fetchScannedHostFindings,
  },
];
