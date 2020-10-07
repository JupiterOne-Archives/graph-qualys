import {
  createDirectRelationship,
  Entity,
  IntegrationError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { createQualysAPIClient } from '../../provider';
import { QualysIntegrationConfig } from '../../types';
import { buildKey } from '../../util';
import { DATA_VMDR_SERVICE_ENTITY, STEP_FETCH_SERVICES } from '../services';
import {
  DATA_HOST_TARGETS,
  DATA_SCANNED_HOST_IDS,
  DATA_VULNERABILITY_FINDING_KEYS,
  STEP_FETCH_SCANNED_HOST_DETAILS,
  STEP_FETCH_SCANNED_HOST_FINDINGS,
  STEP_FETCH_SCANNED_HOST_IDS,
  VmdrEntities,
  VmdrRelationships,
} from './constants';
import {
  createHostFindingEntity,
  createServiceScansDiscoveredHostRelationship,
  createServiceScansEC2HostRelationship,
  getEC2HostArn,
  getTargetsFromHostAsset,
} from './converters';
import { HostAssetTargetsMap, VulnerabilityFindingKeys } from './types';

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
 * Fetches scanned host details and creates mapped relationships between the
 * Service and Host entities.
 *
 * Qualys does not own Host entities, it scans them, so it is important to allow
 * the system mapper to connect the Service to existing Host entities.
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

  const hostAssetTargetsMap: HostAssetTargetsMap = {};

  await apiClient.iterateHostDetails(hostIds, async (host) => {
    if (getEC2HostArn(host)) {
      await jobState.addRelationship(
        createServiceScansEC2HostRelationship(vdmrServiceEntity, host),
      );
    } else {
      await jobState.addRelationship(
        createServiceScansDiscoveredHostRelationship(vdmrServiceEntity, host),
      );
    }

    // Ensure that `DATA_HOST_TARGETS` is updated for each host so that should
    // a partial set be ingested, we don't lose what we've seen for later
    // steps.
    if (host.qwebHostId) {
      hostAssetTargetsMap[host.qwebHostId] = getTargetsFromHostAsset(host);
      await jobState.setData(DATA_HOST_TARGETS, hostAssetTargetsMap);
    } else {
      logger.info(
        { host: { id: host.id } },
        'Unable to store targets for host asset. This may affect global mappings.',
      );
    }
  });
}

/**
 * Fetches scanned host vulnerability detections to create Finding entities and
 * relationships between the Service and Finding. The step also tracks the
 * finding keys per vulnerability ID for use in collecting the vulnerabilty
 * details in a later step.
 */
export async function fetchScannedHostFindings({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);

  const hostIds = (await jobState.getData(DATA_SCANNED_HOST_IDS)) as number[];
  const hostTargetsMap = (await jobState.getData(
    DATA_HOST_TARGETS,
  )) as HostAssetTargetsMap;

  const serviceEntity = (await jobState.getData(
    DATA_VMDR_SERVICE_ENTITY,
  )) as Entity;

  const vulnerabilityFindingKeysCollector = new VulnerabilityFindingKeysCollector();

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
        vulnerabilityFindingKeysCollector.addVulnerabilityFinding(
          detection.QID!,
          findingKey,
        );

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

      // Ensure that `DATA_VULNERABILITY_FINDING_KEYS` is updated for each host
      // so that should a partial set be ingested, we don't lose what we've seen
      // for later steps.
      await jobState.setData(
        DATA_VULNERABILITY_FINDING_KEYS,
        vulnerabilityFindingKeysCollector.toVulnerabilityFindingKeys(),
      );
    },
  );
}

class VulnerabilityFindingKeysCollector {
  private mapping: Map<number, Set<string>>;

  constructor() {
    this.mapping = new Map();
  }

  /**
   * Adds a Finding._key to set of vulnerability findings.
   *
   * @param qid vulnerability QID
   * @param findingKey Finding._key related to vulnerability
   */
  public addVulnerabilityFinding(qid: number, findingKey: string): void {
    if (!qid)
      throw new IntegrationError({
        code: 'UNDEFINED_VULNERABILITY_QID',
        message: 'undefined QID provided for vulnerability',
      });

    let keys = this.mapping[qid];
    if (!keys) {
      keys = new Set();
      this.mapping.set(qid, keys);
    }
    keys.add(findingKey);
  }

  /**
   * Serializes collected values into form that can be stored between steps and
   * used to re-create the Map.
   */
  public toVulnerabilityFindingKeys(): VulnerabilityFindingKeys {
    return Array.from(this.mapping.entries());
  }
}

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
      VmdrRelationships.SERVICE_DISCOVERED_HOST,
      VmdrRelationships.SERVICE_EC2_HOST,
    ],
    dependsOn: [STEP_FETCH_SERVICES, STEP_FETCH_SCANNED_HOST_IDS],
    executionHandler: fetchScannedHostDetails,
  },
  {
    id: STEP_FETCH_SCANNED_HOST_FINDINGS,
    name: 'Fetch Scanned Host Findings',
    entities: [VmdrEntities.HOST_FINDING],
    relationships: [
      VmdrRelationships.SERVICE_FINDING,

      // Global mappings will do the work of building a relationship between the
      // `Finding` and `Host` entities. It depends on the `Finding.targets`
      // containing a value that matches certain properties on the `Host`.
    ],
    dependsOn: [STEP_FETCH_SCANNED_HOST_DETAILS],
    executionHandler: fetchScannedHostFindings,
  },
];
