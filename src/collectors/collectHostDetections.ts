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
  TYPE_QUALYS_HOST,
  TYPE_QUALYS_HOST_FINDING,
  TYPE_QUALYS_VULN,
} from '../converters';
import QualysClient from '../provider/QualysClient';
import toArray from '../util/toArray';
import QualysVulnEntityManager from './QualysVulnEntityManager';
import {
  HostEntityLookupEntry,
  convertHostEntityForLookup,
} from './collectHostAssets';

export default async function collectHostDetections(
  context: IntegrationStepExecutionContext,
  options: {
    qualysClient: QualysClient;
    qualysVulnEntityManager: QualysVulnEntityManager;
    hostEntityLookup: Record<string, HostEntityLookupEntry>;
  },
): Promise<void> {
  const { logger } = context;

  logger.info('Collecting host detections...');

  const { qualysClient, qualysVulnEntityManager, hostEntityLookup } = options;
  const hostDetectionsPaginator = qualysClient.vulnerabilityManagement.listHostDetections(
    {
      // limit is automatically reduced when timeout occurs
      truncation_limit: 750,
      show_igs: 1,
      show_results: 1,

      // High vulnerabilities are those of Severity levels 4 or 5.
      // Vulnerabilities of this group are those that give an attacker the
      // possibility to execute code on the target; easily with a level 5, or
      // less so, with a level 4.
      // Medium vulnerabilities are those of Severity
      // level 3. Low vulnerabilities are those of levels 2 or 1.
      severities: '3-5',
    },
  );

  const seenFindingEntityKeys = new Set<string>();

  do {
    const nextRequest = hostDetectionsPaginator.getNextRequest()!;
    const { pageIndex, cursor, logData } = nextRequest;
    logger.info(
      {
        ...logData,
        pageIndex,
        cursor,
      },
      'Fetching page of host detections...',
    );

    const { responseData } = await hostDetectionsPaginator.nextPage(context);
    const hosts = toArray(
      responseData.HOST_LIST_VM_DETECTION_OUTPUT?.RESPONSE?.HOST_LIST?.HOST,
    );

    if (hosts.length) {
      logger.info(
        {
          numHostDetections: hosts.length,
          pageIndex,
        },
        'Fetched page of host detections',
      );

      for (const host of hosts) {
        const hostId = host.ID!;
        let hostEntityLookupEntry = hostEntityLookup[hostId];

        if (!hostEntityLookupEntry) {
          const hostEntity = convertHostToEntity({
            host,
          });
          hostEntityLookupEntry = convertHostEntityForLookup(hostEntity);
          if (!hostEntityLookupEntry.ec2InstanceId) {
            await context.jobState.addEntities([hostEntity]);
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
          await context.jobState.addEntities([findingEntity]);

          let hostHasFindingRelationship: Relationship;

          // Relate the EC2 Instance to the Finding
          if (hostEntityLookupEntry.ec2InstanceId) {
            hostHasFindingRelationship = createMappedRelationship({
              _class: RelationshipClass.HAS,
              _mapping: {
                relationshipDirection: RelationshipDirection.FORWARD,
                sourceEntityKey: findingEntity._key,
                skipTargetCreation: false,
                targetFilterKeys: [['_type', 'instanceId']],
                targetEntity: {
                  _type: 'aws_instance',
                  instanceId: hostEntityLookupEntry.ec2InstanceId,
                },
              },
            });
          } else {
            hostHasFindingRelationship = createDirectRelationship({
              fromKey: hostEntityLookupEntry._key,
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
      await context.jobState.flush();
    } else if (pageIndex === 0) {
      logger.info(
        {
          responseData,
        },
        'No data in listHostDetections',
      );
    }
  } while (hostDetectionsPaginator.hasNextPage());

  logger.info('Finished collecting host detections');
}
