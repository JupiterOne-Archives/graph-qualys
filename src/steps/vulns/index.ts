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
  createVulnerabilityTargetEntityProperties,
} from './converters';

/**
 * Fetches vulnerability information for each ingested Finding and builds mapped
 * relationships between a Finding and each detected Vulnerability.
 *
 * TODO Add a resource cache for integration (lasts accross invocations) so we
 * don't have to re-load the vuln cve data. Do not store everything, only that
 * necessary for CVE info.
 *
 * @see `createVulnerabilityTargetEntityProperties`
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
    const targetEntityProperties = createVulnerabilityTargetEntityProperties(
      getQualysHost(instance.config.qualysApiUrl),
      vuln,
    );

    const vulnFindingKeys = vulnerabilityFindingKeysMap.get(vuln.QID!);
    if (vulnFindingKeys) {
      for (const findingKey of vulnFindingKeys) {
        const findingEntity = await jobState.findEntity(findingKey);
        if (!findingEntity) {
          // This is unexpected. The previous step only adds the Finding._key when
          // it adds a Finding to the `jobState`.
          logger.warn(
            { qid: vuln.QID, findingKey },
            'Finding entity not found',
          );
        } else {
          await jobState.addRelationships(
            createFindingVulnerabilityMappedRelationships(
              findingEntity,
              targetEntityProperties,
            ),
          );
        }
      }
    } else {
      // This is unexpected. The previous step should only add the QID to the
      // `vulnerabilityFindingKeysMap` when there were findings.
      logger.warn(
        { qid: vuln.QID },
        'No finding IDs associated with vulnerability',
      );
    }
  });
}

/**
 * Answers a single map of qid -> Finding._key[] from all steps that collected
 * Finding entities.
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
