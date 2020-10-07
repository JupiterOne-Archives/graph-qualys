import {
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

import { createQualysAPIClient } from '../../provider';
import { QualysIntegrationConfig } from '../../types';
import { getQualysHost } from '../../util';
import {
  DATA_VULNERABILITY_FINDING_KEYS,
  STEP_FETCH_SCANNED_HOST_FINDINGS,
} from '../vmdr/constants';
import { VulnerabilityFindingKeys } from '../vmdr/types';
import { STEP_FETCH_SCANNED_HOST_VULNS, VulnRelationships } from './constants';
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
  const vulnerabilityFindingKeys = (await jobState.getData(
    DATA_VULNERABILITY_FINDING_KEYS,
  )) as VulnerabilityFindingKeys;
  const vulnerabilityFindingKeysMap = new Map(vulnerabilityFindingKeys);
  const vulnerabilityIds = Array.from(vulnerabilityFindingKeysMap.keys());

  const apiClient = createQualysAPIClient(logger, instance.config);

  await apiClient.iterateVulnerabilities(vulnerabilityIds, async (vuln) => {
    const targetEntityProperties = createVulnerabilityTargetEntityProperties(
      getQualysHost(instance.config.qualysApiUrl),
      vuln,
    );

    const vulnFindingKeys = vulnerabilityFindingKeysMap.get(vuln.QID!);
    if (vulnFindingKeys) {
      for (const findingKey of vulnFindingKeys) {
        const findingEntity = await jobState.findEntity(findingKey);
        if (!findingEntity) {
          // This is unexpected. The previous step only add the Finding._key when
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

export const vulnSteps: IntegrationStep<QualysIntegrationConfig>[] = [
  {
    id: STEP_FETCH_SCANNED_HOST_VULNS,
    name: 'Fetch Finding Vulnerability Details',
    entities: [],
    relationships: [
      VulnRelationships.FINDING_QUALYS_VULN,
      VulnRelationships.FINDING_CVE_VULN,
    ],
    dependsOn: [STEP_FETCH_SCANNED_HOST_FINDINGS],
    executionHandler: fetchFindingVulnerabilities,
  },
];
