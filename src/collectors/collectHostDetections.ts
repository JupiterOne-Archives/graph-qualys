import toArray from '../util/toArray';
import {
  TYPE_QUALYS_HOST,
  TYPE_QUALYS_HOST_FINDING,
  TYPE_QUALYS_VULN,
  buildQualysVulnKey,
  buildHostKey,
  convertHostToEntity,
  convertHostDetectionToEntity,
} from '../converters';
import QualysClient from '../provider/QualysClient';
import {
  IntegrationStepExecutionContext,
  createIntegrationRelationship,
} from '@jupiterone/integration-sdk';
import QualysVulnEntityManager from './QualysVulnEntityManager';

export default async function collectHostDetections(
  context: IntegrationStepExecutionContext,
  options: {
    qualysClient: QualysClient;
    qualysVulnEntityManager: QualysVulnEntityManager;
    hostAssetIdSet: Set<number>;
  },
) {
  const { logger } = context;

  logger.info('Collecting host detections...');

  const { qualysClient, qualysVulnEntityManager, hostAssetIdSet } = options;
  const hostDetectionsPaginator = qualysClient.vulnerabilityManagement.listHostDetections(
    {
      truncation_limit: 1000,
      show_igs: 1,
      show_results: 1,
      severities: '1-5',
    },
  );

  do {
    const { responseData } = await hostDetectionsPaginator.nextPage();
    const hosts = toArray(
      responseData.HOST_LIST_VM_DETECTION_OUTPUT?.RESPONSE?.HOST_LIST?.HOST,
    );

    for (const host of hosts) {
      const hostId = host.ID!;
      let hostKey: string;

      if (hostAssetIdSet.has(hostId)) {
        hostKey = buildHostKey({
          qwebHostId: hostId,
        });
      } else {
        const hostEntity = convertHostToEntity({
          host,
        });
        context.jobState.addEntities([hostEntity]);
        hostKey = hostEntity._key;
      }

      const detections = toArray(host.DETECTION_LIST?.DETECTION);
      for (const detection of detections) {
        qualysVulnEntityManager.addQID(detection.QID!);
      }

      for (const detection of detections) {
        const vulnFromKnowledgeBase = await qualysVulnEntityManager.getVulnerabilityByQID(
          detection.QID!,
        );

        const findingEntity = convertHostDetectionToEntity({
          detection,
          hostId,
          vulnFromKnowledgeBase,
        });

        // Create the Finding
        context.jobState.addEntities([findingEntity]);

        // Relate the Host to the Finding
        const hostHasFindingRelationship = createIntegrationRelationship({
          fromKey: hostKey,
          toKey: findingEntity._key,
          fromType: TYPE_QUALYS_HOST,
          toType: TYPE_QUALYS_HOST_FINDING,
          _class: 'HAS',
        });

        await context.jobState.addRelationships([hostHasFindingRelationship]);

        // Relate the Finding to the Vulnerability
        const findingIsVulnerabilityRelationship = createIntegrationRelationship(
          {
            fromKey: findingEntity._key,
            toKey: buildQualysVulnKey({
              qid: detection.QID!,
            }),
            fromType: TYPE_QUALYS_HOST_FINDING,
            toType: TYPE_QUALYS_VULN,
            _class: 'IS',
          },
        );

        await context.jobState.addRelationships([
          findingIsVulnerabilityRelationship,
        ]);
      }
    }
  } while (hostDetectionsPaginator.hasNextPage());

  logger.info('Finished collecting host detections');
}
