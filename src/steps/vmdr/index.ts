import { chunk } from 'lodash';
import { v4 as uuid } from 'uuid';

import {
  Entity,
  IntegrationInfoEventName,
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

import { createQualysAPIClient } from '../../provider';
import { QWebHostId } from '../../provider/client';
import {
  HostDetection,
  ListScannedHostIdsFilters,
} from '../../provider/client/types/vmpc';
import {
  CalculatedIntegrationConfig,
  QualysIntegrationConfig,
} from '../../types';
import { buildKey } from '../../util';
import { DATA_VMDR_SERVICE_ENTITY, STEP_FETCH_SERVICES } from '../services';
import { VulnerabilityFindingKeysCollector } from '../utils';
import {
  DATA_HOST_ASSET_TARGETS,
  DATA_HOST_VULNERABILITY_FINDING_KEYS,
  DATA_SCANNED_HOST_IDS,
  STEP_FETCH_SCANNED_HOST_DETAILS,
  STEP_FETCH_SCANNED_HOST_FINDINGS,
  STEP_FETCH_SCANNED_HOST_IDS,
  VmdrEntities,
  VmdrMappedRelationships,
} from './constants';
import {
  createHostFindingEntity,
  createServiceScansDiscoveredHostAssetRelationship,
  createServiceScansEC2HostAssetRelationship,
  createServiceScansGCPHostAssetRelationship,
  getEC2HostAssetArn,
  getGCPHostProjectId,
  getHostAssetTargets,
} from './converters';
import { Description, HostAssetTargetsMap } from './types';

/**
 * This is the number of pages that must be traversed before producing a more
 * verbose set of logging. The host detections code is hot and we don't want to
 * log too frequently.
 */
const HOST_DETECTIONS_PAGE_LOG_FREQUENCY = 10000;

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

  const filters: ListScannedHostIdsFilters = {
    vm_processed_after: instance.config.minScannedSinceISODate,
    vm_processed_before: instance.config.maxScannedSinceISODate,
  };

  const loggerFetch = logger.child({ filters });

  let loggedIdsDataType = false;
  const hostIds: QWebHostId[] = [];
  await apiClient.iterateScannedHostIds(
    (pageOfIds) => {
      for (const hostId of pageOfIds) {
        if (!loggedIdsDataType && typeof hostId !== 'number') {
          loggerFetch.info(
            { hostId, type: typeof hostId },
            'Data type of host id is not number',
          );
          loggedIdsDataType = true;
        }
        hostIds.push(hostId);
      }
      loggerFetch.info(
        { numScannedHostIds: hostIds.length },
        'Fetched page of scanned host IDs',
      );
    },
    {
      filters,
    },
  );

  await jobState.setData(DATA_SCANNED_HOST_IDS, hostIds);

  loggerFetch.info(
    { numScannedHostIds: hostIds.length },
    'Finished fetching scanned host IDs',
  );

  loggerFetch.publishInfoEvent({
    name: IntegrationInfoEventName.Stats,
    description: `Found ${hostIds.length} hosts with filters: ${JSON.stringify(
      filters,
    )}`,
  });
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
  const hostIds = ((await jobState.getData(DATA_SCANNED_HOST_IDS)) ||
    []) as number[];
  const vdmrServiceEntity = (await jobState.getData(
    DATA_VMDR_SERVICE_ENTITY,
  )) as Entity;
  const apiClient = createQualysAPIClient(logger, instance.config);

  const errorCorrelationId = uuid();

  let totalHostsProcessed = 0;
  let totalPageErrors = 0;

  const hostAssetTargetsMap: HostAssetTargetsMap = {};
  await apiClient.iterateHostDetails(
    hostIds,
    async (host) => {
      if (getEC2HostAssetArn(host)) {
        await jobState.addRelationship(
          createServiceScansEC2HostAssetRelationship(vdmrServiceEntity, host),
        );
      } else if (getGCPHostProjectId(host)) {
        await jobState.addRelationship(
          createServiceScansGCPHostAssetRelationship(vdmrServiceEntity, host),
        );
      } else {
        await jobState.addRelationship(
          createServiceScansDiscoveredHostAssetRelationship(
            vdmrServiceEntity,
            host,
          ),
        );
      }

      if (host.qwebHostId) {
        hostAssetTargetsMap[host.qwebHostId] = getHostAssetTargets(host);
      } else {
        logger.info(
          { host: { id: host.id } },
          'Unable to store targets for host asset. This may affect global mappings.',
        );
      }

      totalHostsProcessed++;
    },
    {
      onRequestError(pageIds, err) {
        totalPageErrors++;
        logger.error(
          { pageIds, err, errorCorrelationId, totalPageErrors },
          'Error ingesting page of scanned host details',
        );
      },
    },
  );

  await jobState.setData(DATA_HOST_ASSET_TARGETS, hostAssetTargetsMap);

  logger.publishInfoEvent({
    name: IntegrationInfoEventName.Stats,
    description: `Processed details for ${totalHostsProcessed} of ${
      hostIds.length
    } hosts${
      totalPageErrors > 0
        ? `, encountered errors on ${totalPageErrors} pages (errorId="${errorCorrelationId}")`
        : ''
    }`,
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
  const { config } = instance;

  const detectionTypes = config.vmdrFindingTypeValues;
  const hostIds = ((await jobState.getData(DATA_SCANNED_HOST_IDS)) ||
    []) as number[];
  const hostAssetTargetsMap = ((await jobState.getData(
    DATA_HOST_ASSET_TARGETS,
  )) || {}) as HostAssetTargetsMap;
  const vulnerabilityFindingKeysCollector = new VulnerabilityFindingKeysCollector();

  // const serviceEntity = (await jobState.getData(
  //   DATA_VMDR_SERVICE_ENTITY,
  // )) as Entity;

  const errorCorrelationId = uuid();

  let totalHostsProcessed = 0;
  let totalDetectionsProcessed = 0;
  let totalUnmatchedTypeDetections = 0;
  let totalPageErrors = 0;

  let totalEc2FindingsProcessed = 0;

  const apiClient = createQualysAPIClient(logger, config);
  await apiClient.iterateHostDetections(
    hostIds,
    async ({ host, detections }) => {
      let numBadQids = 0;

      // TODO: consider having jobState.batch(detections, ([detection, ...]) => {...})
      // so that we don't have to know what the optimal batch size is
      for (const batchDetections of chunk(detections, 500)) {
        const entities: Entity[] = [];
        // const relationships: Relationship[] = [];

        for (const detection of batchDetections) {
          // The Qualys API has been broken in the past so that the XML was
          // invalid in some way, producing a bunch of invalid detection
          // objects. In that case, it was possible to detect by checking they
          // type of the value.
          if (typeof detection.QID !== 'number') {
            numBadQids++;
            continue;
          }

          if (detection.TYPE && !detectionTypes.includes(detection.TYPE)) {
            totalUnmatchedTypeDetections++;
            continue;
          }

          /**
           * A host may have many detections of the same vulnerability on
           * different ports/protocols/ssl.
           */
          const findingKey = buildKey({
            qid: detection.QID,
            type: detection.TYPE,
            port: detection.PORT,
            protocol: detection.PROTOCOL,
            ssl: detection.SSL,
            hostId: host.ID,
          });

          if (jobState.hasKey(findingKey)) continue;

          vulnerabilityFindingKeysCollector.addVulnerabilityFindingKey(
            detection.QID!,
            findingKey,
          );

          let desc: Description = {};
          await apiClient.iterateVulnerabilities(
            [detection.QID],
            (details) => {
              const {
                DIAGNOSIS: description,
                CONSEQUENCE: impact,
                SOLUTION: recommendation,
                CVE_LIST: cveList,
              } = details;

              desc = {
                description,
                impact,
                recommendation,
                reference: Array.isArray(cveList?.CVE)
                  ? cveList?.CVE?.map((cve) => cve.URL).join('\n')
                  : cveList?.CVE?.URL,
              };
            },
            {
              onRequestError: (_pageIds, err) => {
                logger.error(err);
              },
            },
          );

          const findingEntity = createHostFindingEntity({
            key: findingKey,
            host,
            detection,
            detectionResults: shouldIncludeResultsForVulnerability(
              config,
              detection,
            )
              ? detection.RESULTS?.substring(0, 300)
              : undefined,
            hostAssetTargets: hostAssetTargetsMap[host.ID!],
            desc,
          });
          entities.push(findingEntity);

          if (findingEntity.ec2InstanceArn) {
            totalEc2FindingsProcessed++;
          }

          // relationships.push(
          //   createDirectRelationship({
          //     _class: RelationshipClass.IDENTIFIED,
          //     from: serviceEntity,
          //     to: findingEntity,
          //   }),
          // );
        }

        await jobState.addEntities(entities);
        // await jobState.addRelationships(relationships);
      }

      totalHostsProcessed++; // This only counts the hosts that have detections
      totalDetectionsProcessed += detections.length;

      if (numBadQids > 0) {
        logger.warn(
          {
            numBadQids,
          },
          'Skipping detections for QID values that are not typeof number',
        );
      }

      // This code is hot and we don't want to be logging all of the time.
      // We largely reduce the number of logs by ensuring that we only log every
      // so often.
      const shouldLogPageVerbose =
        totalHostsProcessed % HOST_DETECTIONS_PAGE_LOG_FREQUENCY === 0 &&
        totalHostsProcessed !== 0;

      if (shouldLogPageVerbose) {
        logger.info(
          {
            totalDetectionsProcessed,
            totalUnmatchedTypeDetections,
            totalHostsProcessed,
            totalPageErrors,
          },
          'Processing detections for hosts...',
        );
      }
    },
    {
      includeResults: !!config.vmdrFindingResultQidNumbers.length,
      filters: {
        detection_updated_since: config.minFindingsSinceISODate,
        detection_updated_before: config.maxFindingsSinceISODate,
        severities: config.vmdrFindingSeverityNumbers,
        status: 'New,Fixed,Active,Re-Opened',
      },
      onRequestError(pageIds, err) {
        totalPageErrors++;
        logger.error(
          { pageIds, err, errorCorrelationId, totalPageErrors },
          'Error processing page of hosts',
        );
      },
    },
  );

  logger.info(
    {
      totalDetectionsProcessed,
      totalEc2FindingsProcessed,
      totalUnmatchedTypeDetections,
      totalHostsEncountered: hostIds.length,
      totalHostsProcessed,
      totalPageErrors,
    },
    'Host and Detections processing summary',
  );

  await jobState.setData(
    DATA_HOST_VULNERABILITY_FINDING_KEYS,
    vulnerabilityFindingKeysCollector.serialize(),
  );

  logger.publishInfoEvent({
    name: IntegrationInfoEventName.Stats,
    description: `Processed detections for ${totalHostsProcessed} of ${
      hostIds.length
    } hosts${
      totalPageErrors > 0
        ? `, encountered errors on ${totalPageErrors} pages (errorId="${errorCorrelationId}")`
        : ''
    }`,
  });
}

function shouldIncludeResultsForVulnerability(
  config: CalculatedIntegrationConfig,
  detection: HostDetection,
): boolean {
  return !!(
    detection.QID &&
    config.vmdrFindingResultQidNumbers.includes(detection.QID) &&
    detection.RESULTS
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
    mappedRelationships: [
      VmdrMappedRelationships.SERVICE_DISCOVERED_HOST,
      VmdrMappedRelationships.SERVICE_EC2_HOST,
      VmdrMappedRelationships.SERVICE_GCP_HOST,
    ],
    relationships: [],
    dependsOn: [STEP_FETCH_SERVICES, STEP_FETCH_SCANNED_HOST_IDS],
    executionHandler: fetchScannedHostDetails,
  },
  {
    id: STEP_FETCH_SCANNED_HOST_FINDINGS,
    name: 'Fetch Scanned Host Findings',
    entities: [VmdrEntities.HOST_FINDING],
    relationships: [
      // VmdrRelationships.SERVICE_HOST_FINDING,
      // Global mappings will do the work of building a relationship between the
      // `Finding` and `Host` entities. It depends on the `Finding.targets`
      // containing a value that matches certain properties on the `Host`.
    ],
    dependsOn: [STEP_FETCH_SCANNED_HOST_DETAILS],
    executionHandler: fetchScannedHostFindings,
  },
];
