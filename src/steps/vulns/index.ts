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
 * Fetches vulnerability information for each ingested Finding and builds mapped
 * relationships between a Finding and each detected Vulnerability.
 *
 * TODO Handle CWEs in Findings as mapped relationship to Weakness entities
 *
 * TODO Add a resource cache for integration (accessible across invocations) so
 * we don't have to re-load the vuln CVE data. Do not store everything, only
 * that necessary for CVE info.
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

  await apiClient.iterateVulnerabilities(vulnerabilityQIDs, async (vuln) => {
    const targetEntities = createVulnerabilityTargetEntities(
      getQualysHost(instance.config.qualysApiUrl),
      vuln,
    );

    const vulnFindingKeys = vulnerabilityFindingKeysMap.get(vuln.QID!);
    if (vulnFindingKeys) {
      for (const findingKey of vulnFindingKeys) {
        const findingEntity = await jobState.findEntity(findingKey);
        if (!findingEntity) {
          logger.warn(
            { qid: vuln.QID, findingKey },
            'Previous ingestion steps failed to store Finding in job state for _key',
          );
        } else {
          const {
            relationships,
            duplicates,
          } = createFindingVulnerabilityMappedRelationships(
            findingEntity,
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
      }
    } else {
      logger.warn(
        { qid: vuln.QID },
        'Previous ingestion steps failed to associate Finding _keys with vulnerability',
      );
    }
  });
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
