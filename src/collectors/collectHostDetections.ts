import {
  createDirectRelationship,
  createMappedRelationship,
  IntegrationStepExecutionContext,
  Relationship,
  RelationshipClass,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core';

import {
  buildQualysVulnKey,
  convertHostDetectionToEntity,
  convertHostToEntity,
  isHostEC2Instance,
  TYPE_QUALYS_HOST,
  TYPE_QUALYS_HOST_FINDING,
  TYPE_QUALYS_VULN,
} from '../converters';
import { HostEntity } from '../converters/types';
import QualysClient from '../provider/QualysClient';
import toArray from '../util/toArray';
import QualysVulnEntityManager from './QualysVulnEntityManager';

export default async function collectHostDetections(
  context: IntegrationStepExecutionContext,
  options: {
    qualysClient: QualysClient;
    qualysVulnEntityManager: QualysVulnEntityManager;
    hostEntityLookup: Record<string, HostEntity>;
  },
): Promise<void> {
  const { logger } = context;

  logger.info('Collecting host detections...');

  const { qualysClient, qualysVulnEntityManager, hostEntityLookup } = options;
  const hostDetectionsPaginator = qualysClient.vulnerabilityManagement.listHostDetections(
    {
      truncation_limit: 1000,
      show_igs: 1,
      show_results: 1,
      severities: '1-5',
    },
  );

  let pageIndex = 0;

  const seenFindingEntityKeys = new Set<string>();

  do {
    const { responseData } = await hostDetectionsPaginator.nextPage();
    const hosts = toArray(
      responseData.HOST_LIST_VM_DETECTION_OUTPUT?.RESPONSE?.HOST_LIST?.HOST,
    );

    if (hosts.length) {
      for (const host of hosts) {
        const hostId = host.ID!;
        let hostEntity: HostEntity = hostEntityLookup[hostId];

        if (!hostEntity) {
          hostEntity = convertHostToEntity({
            host,
          });
          if (!isHostEC2Instance(hostEntity)) {
            context.jobState.addEntities([hostEntity]);
          }
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

          // Avoid duplicates by checking to see if we already have a Finding
          // for this webapp that is basically identical.
          if (seenFindingEntityKeys.has(findingEntity._key)) {
            continue;
          }

          seenFindingEntityKeys.add(findingEntity._key);

          // Create the Finding
          context.jobState.addEntities([findingEntity]);

          let hostHasFindingRelationship: Relationship;

          // Relate the Host to the Finding
          if (isHostEC2Instance(hostEntity)) {
            hostHasFindingRelationship = createMappedRelationship({
              _class: RelationshipClass.HAS,
              _mapping: {
                relationshipDirection: RelationshipDirection.FORWARD,
                sourceEntityKey: findingEntity._key,
                skipTargetCreation: false,
                targetFilterKeys: [['_type', 'instanceId']],
                targetEntity: {
                  _type: 'aws_instance',
                  instanceId: hostEntity.instanceId,
                },
              },
            });
          } else {
            hostHasFindingRelationship = createDirectRelationship({
              fromKey: hostEntity._key,
              toKey: findingEntity._key,
              fromType: TYPE_QUALYS_HOST,
              toType: TYPE_QUALYS_HOST_FINDING,
              _class: RelationshipClass.HAS,
            });
          }

          await context.jobState.addRelationships([hostHasFindingRelationship]);

          // Relate the Finding to the Vulnerability
          const findingIsVulnerabilityRelationship = createDirectRelationship({
            fromKey: findingEntity._key,
            toKey: buildQualysVulnKey({
              qid: detection.QID!,
            }),
            fromType: TYPE_QUALYS_HOST_FINDING,
            toType: TYPE_QUALYS_VULN,
            _class: RelationshipClass.IS,
          });

          await context.jobState.addRelationships([
            findingIsVulnerabilityRelationship,
          ]);
        }
      }
    } else if (pageIndex === 0) {
      logger.info(
        {
          responseData,
        },
        'No data in listHostDetections',
      );
    }

    pageIndex++;
  } while (hostDetectionsPaginator.hasNextPage());

  logger.info('Finished collecting host detections');
}
