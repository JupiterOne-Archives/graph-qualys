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
  VulnerabilityFindingKeysCollector,
} from '../utils';
import { DATA_HOST_VULNERABILITY_FINDING_KEYS } from '../vmdr/constants';
import { DATA_WEBAPP_VULNERABILITY_FINDING_KEYS } from '../was/constants';
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
  const qualysHost = getQualysHost(instance.config.qualysApiUrl);
  const apiClient = createQualysAPIClient(logger, instance.config);

  const vulnerabiltyFindingKeysCollector = new VulnerabilityFindingKeysCollector();
  await loadVulnerabilityFindingKeys(
    vulnerabiltyFindingKeysCollector,
    jobState,
  );

  const errorCorrelationId = uuid();

  let totalVulnerabilitiesProcessed = 0;
  let totalFindingsProcessed = 0;
  let totalPageErrors = 0;

  await apiClient.iterateVulnerabilities(
    vulnerabiltyFindingKeysCollector.allQids(),
    async (vuln) => {
      const targetEntities = createVulnerabilityTargetEntities(
        qualysHost,
        vuln,
      );

      const vulnFindingKeys = vulnerabiltyFindingKeysCollector.getVulnerabiltyFindingKeys(
        vuln.QID!,
      );

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
async function loadVulnerabilityFindingKeys(
  collector: VulnerabilityFindingKeysCollector,
  jobState: JobState,
): Promise<void> {
  for (const dataKey of [
    DATA_WEBAPP_VULNERABILITY_FINDING_KEYS,
    DATA_HOST_VULNERABILITY_FINDING_KEYS,
  ]) {
    collector.loadSerialized(await popFindingKeys(jobState, dataKey));
  }
}

/**
 * Fetches from `jobState` and deserializes the map of QID -> `Finding._key[]`
 * identified by `dataKey`. The data will be removed from the `jobState` to free
 * up resources.
 */
async function popFindingKeys(jobState: JobState, dataKey: string) {
  const findingKeys =
    ((await jobState.getData(dataKey)) as SerializedVulnerabilityFindingKeys) ||
    [];
  await jobState.setData(dataKey, []);
  return findingKeys;
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
    dependsOn: [],
    executionHandler: fetchFindingVulnerabilities,
    dependencyGraphId: 'last',
  },
];
