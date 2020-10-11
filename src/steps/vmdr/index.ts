import {
  createDirectRelationship,
  Entity,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { createQualysAPIClient } from '../../provider';
import { QWebHostId } from '../../provider/client';
import { QualysIntegrationConfig } from '../../types';
import { buildKey } from '../../util';
import { DATA_VMDR_SERVICE_ENTITY, STEP_FETCH_SERVICES } from '../services';
import { VulnerabilityFindingKeysCollector } from '../utils';
import {
  DATA_HOST_TARGETS,
  DATA_HOST_VULNERABILITY_FINDING_KEYS,
  DATA_SCANNED_HOST_IDS,
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
import { HostAssetTargetsMap } from './types';

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

  // `filter` reflects parameters used to limit the set of hosts processed by the
  // integration. A value of `'all'` means no filters were used so that all
  // hosts are processed.
  const loggerFetch = logger.child({ filter: 'all' });

  const hostIds: QWebHostId[] = [];
  await apiClient.iterateScannedHostIds((pageOfIds) => {
    pageOfIds.forEach((e) => hostIds.push(e));
    loggerFetch.info(
      { numScannedHostIds: hostIds.length },
      'Fetched page of scanned host IDs',
    );
  });

  await jobState.setData(DATA_SCANNED_HOST_IDS, hostIds);

  loggerFetch.info(
    { numScannedHostIds: hostIds.length },
    'Finished fetching scanned host IDs',
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

      // Ensure that `DATA_HOST_VULNERABILITY_FINDING_KEYS` is updated for each host
      // so that should a partial set be ingested, we don't lose what we've seen
      // for later steps.
      await jobState.setData(
        DATA_HOST_VULNERABILITY_FINDING_KEYS,
        vulnerabilityFindingKeysCollector.toVulnerabilityFindingKeys(),
      );
    },
  );
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
      VmdrRelationships.SERVICE_HOST_FINDING,

      // Global mappings will do the work of building a relationship between the
      // `Finding` and `Host` entities. It depends on the `Finding.targets`
      // containing a value that matches certain properties on the `Host`.
    ],
    dependsOn: [STEP_FETCH_SCANNED_HOST_DETAILS],
    executionHandler: fetchScannedHostFindings,
  },
];