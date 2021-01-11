import { v4 as uuid } from 'uuid';

import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  JobState,
} from '@jupiterone/integration-sdk-core';

import { createQualysAPIClient } from '../../provider';
import { QualysIntegrationConfig } from '../../types';
import { getQualysHost } from '../../util';
import {
  SerializedVulnerabilityFindingKeys,
  VulnerabilityFindingKeysMap,
} from '../utils';
import {
  DATA_HOST_VULNERABILITY_FINDING_KEYS,
  STEP_FETCH_SCANNED_HOST_FINDINGS,
} from '../vmdr/constants';
import {
  DATA_WEBAPP_VULNERABILITY_FINDING_KEYS,
  STEP_FETCH_SCANNED_WEBAPP_FINDINGS,
} from '../was/constants';
import { STEP_FETCH_FINDING_VULNS, VulnRelationships } from './constants';
import {
  createFindingVulnerabilityMappedRelationships,
  createVulnerabilityTargetEntities,
} from './converters';

/**
 * This is the number of vulnerabilities that must be traversed before producing
 * a more verbose set of logging.
 */
const VULNERABILTIES_LOG_FREQUENCY = 500;

/**
 * Fetches vulnerability information for each ingested Finding and builds mapped
 * relationships between a Finding and each detected Vulnerability.
 *
 * TODO Handle CWEs in Findings as mapped relationship to Weakness entities
 *
 * TODO Add a resource cache for integration (accessible across invocations) so
 * we don't have to re-load the vuln CVE data. Do not store everything, only
 * that necessary for CVE info.
 *
 * TODO: Consider a FindingUploaderThingy that has a cache/fetches Vulns at
 * threshold, then patches Findings with some vuln details and then adds to
 * jobState.
 *
 * @see `createVulnerabilityTargetEntities`
 */
export async function fetchFindingVulnerabilities({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);

  const vulnerabilityFindingKeysMap = await getVulnerabilityFindingKeysMap(
    jobState,
  );
  const vulnerabilityQIDs = Array.from(vulnerabilityFindingKeysMap.keys());

  const errorCorrelationId = uuid();

  let totalVulnerabilitiesProcessed = 0;
  let totalFindingsProcessed = 0;
  let totalPageErrors = 0;

  await apiClient.iterateVulnerabilities(
    vulnerabilityQIDs,
    async (vuln) => {
      const targetEntities = createVulnerabilityTargetEntities(
        getQualysHost(instance.config.qualysApiUrl),
        vuln,
      );

      const vulnFindingKeys = vulnerabilityFindingKeysMap.get(vuln.QID!);
      if (vulnFindingKeys) {
        for (const findingKey of vulnFindingKeys) {
          if (!jobState.hasKey(findingKey)) {
            logger.warn(
              { qid: vuln.QID, findingKey },
              'Previous ingestion steps failed to store Finding in job state for _key',
            );
          } else {
            const {
              relationships,
              duplicates,
            } = createFindingVulnerabilityMappedRelationships(
              findingKey,
              targetEntities,
            );

            await jobState.addRelationships(relationships);

            if (duplicates.length > 0) {
              logger.warn(
                { qid: vuln.QID, duplicateKeys: duplicates.map((e) => e._key) },
                'Finding appears to have duplicate related vulnerabilities, need to create a better Finding._key?',
              );
            }
          }

          totalFindingsProcessed++;
        }
      } else {
        logger.warn(
          { qid: vuln.QID },
          'Previous ingestion steps failed to associate Finding _keys with vulnerability',
        );
      }

      totalVulnerabilitiesProcessed++;

      // This code is hot and we don't want to be logging all of the time.
      // We largely reduce the number of logs by ensuring that we only log every
      // so often.
      const shouldLogPageVerbose =
        totalVulnerabilitiesProcessed % VULNERABILTIES_LOG_FREQUENCY === 0 &&
        totalVulnerabilitiesProcessed !== 0;

      if (shouldLogPageVerbose) {
        logger.info(
          {
            totalVulnerabilitiesProcessed,
            totalFindingsProcessed,
            totalPageErrors,
          },
          'Processing vulnerabilities...',
        );
      }
    },
    {
      onRequestError(pageIds, err) {
        totalPageErrors++;
        logger.error(
          { pageIds, err, errorCorrelationId, totalPageErrors },
          'Error processing page of vulnerabilities',
        );
      },
    },
  );
}

/**
 * Answers a map of QID -> `Finding._key[]` from all steps that collected
 * Finding entities.
 *
 * The Finding ingestion steps will store a mapping of QID to each
 * `Finding._key` associated with the vulnerability. This allows
 * `STEP_FETCH_FINDING_VULNS` to know which vulnerabilities to fetch and to
 * which Finding entites to map relationships.
 */
async function getVulnerabilityFindingKeysMap(
  jobState: JobState,
): Promise<VulnerabilityFindingKeysMap> {
  const hostSerializedKeysMap = new Map(
    ((await jobState.getData(
      DATA_HOST_VULNERABILITY_FINDING_KEYS,
    )) as SerializedVulnerabilityFindingKeys) || [],
  );

  const webAppSerializedKeysMap = new Map(
    ((await jobState.getData(
      DATA_WEBAPP_VULNERABILITY_FINDING_KEYS,
    )) as SerializedVulnerabilityFindingKeys) || [],
  );

  const keysMap = new Map() as VulnerabilityFindingKeysMap;
  const addKeys = (qid: number, keys: Set<string>) => {
    const allQidFindingKeys = keysMap.get(qid) || new Set();
    if (allQidFindingKeys.size === 0) keysMap.set(qid, allQidFindingKeys);
    keys.forEach((e) => allQidFindingKeys.add(e));
  };

  for (const [qid, findingKeys] of hostSerializedKeysMap.entries()) {
    addKeys(qid, findingKeys);
  }

  for (const [qid, findingKeys] of webAppSerializedKeysMap.entries()) {
    addKeys(qid, findingKeys);
  }

  return keysMap;
}

export const vulnSteps: IntegrationStep<QualysIntegrationConfig>[] = [
  {
    id: STEP_FETCH_FINDING_VULNS,
    name: 'Fetch Finding Vulnerability Details',
    entities: [],
    relationships: [
      VulnRelationships.HOST_FINDING_QUALYS_VULN,
      VulnRelationships.HOST_FINDING_CVE_VULN,
      VulnRelationships.WEBAPP_FINDING_QUALYS_VULN,
      VulnRelationships.WEBAPP_FINDING_CVE_VULN,
    ],
    dependsOn: [
      STEP_FETCH_SCANNED_HOST_FINDINGS,
      STEP_FETCH_SCANNED_WEBAPP_FINDINGS,
    ],
    executionHandler: fetchFindingVulnerabilities,
  },
];
