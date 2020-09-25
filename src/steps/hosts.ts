import {
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';
import { TYPE_QUALYS_HOST } from '../converters';

import { createQualysAPIClient } from '../provider';
import { QualysIntegrationConfig } from '../types';

const DATA_HOST_ASSET_IDS = 'DATA_HOST_ASSET_IDS';

export async function fetchHostIds({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);
  const hostIds = await apiClient.fetchHostIds();
  await jobState.setData(DATA_HOST_ASSET_IDS, hostIds);

  logger.info({ hostIds: hostIds.length }, 'Host IDs collected');
}

export async function fetchHostVulnerabilities({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);

  const hostIds = (await jobState.getData(DATA_HOST_ASSET_IDS)) as string[];
  await apiClient.iterateHostDetections(hostIds, ({ host, detections }) => {
    // TODO create Finding, mapped relationship to Host
  });
}

// export async function fetchHosts({
//   logger,
//   instance,
//   jobState,
// }: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
//   const apiClient = createQualysAPIClient(logger, instance.config);

//   await apiClient.iterateHosts(async (data) => {
//     const isEC2 = isHostEC2Instance(data);

//     // ec2 hosts should be targets of mapped relationships
//     // skip hosts that have already been seen by detections

//     const qwebHostId = data.qwebHostId!;
//     const hostKey = buildHostKey({
//       qwebHostId,
//     });

//     const hostname = data.dnsHostName || data.fqdn;
//     const hostEC2Metadata = data.sourceInfo?.list?.Ec2AssetSourceSimple;
//     let hostEntityEC2Metadata: HostEntityEC2Metadata | undefined;

//     if (hostEC2Metadata) {
//       const { ec2InstanceTags, ...metadata } = hostEC2Metadata;
//       hostEntityEC2Metadata = metadata;
//     }

//     await jobState.addEntity(
//       createIntegrationEntity({
//         entityData: {
//           source: data as any,
//           assign: {
//             _type: TYPE_QUALYS_HOST,
//             _key: hostKey,
//             _class: 'Host',
//             name: data.name || hostname!,
//             displayName: data.name,
//             hostname: hostname!,
//             hostId: qwebHostId,
//             assetId: data.id!,
//             fqdn: data.fqdn,
//             os: data.os,
//             platform: determinePlatform(data),
//             lastScannedOn: parseTimePropertyValue(data.lastVulnScan),
//             ...hostEntityEC2Metadata,
//           },
//         },
//       }),
//     );
//   }, new Date(Date.now() - MAX_LAST_SCAN_AGE));
// }

// export async function fetchHostVulnerabilities({
//   logger,
//   instance,
//   jobState,
// }: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
//   const apiClient = await createQualysAPIClient(logger, instance.config);
//   const seenFindings: string[] = [];

//   await apiClient.iterateHostDetections(async ({ host, detections }) => {
//     const hostEntity = await findOrCreateHostEntityForDetectionHost(jobState, host);

//     for (const detection of detections) {
//       const findingKey = buildKey({
//         qid: detection.QID,
//         port: detection.PORT,
//         protocol: detection.PROTOCOL,
//         ssl: detection.SSL,
//         hostId: host.ID,
//       });

//       if (seenFindings.includes(findingKey)) {
//         continue;
//       }
//       seenFindings.push(findingKey);

//       const findingDisplayName = `QID ${detection.QID}`;
//       const findingEntity = await jobState.addEntity(
//         createIntegrationEntity({
//           entityData: {
//             source: {
//               results: detection.RESULTS,
//             },
//             assign: {
//               _type: TYPE_QUALYS_HOST_FINDING,
//               _key: findingKey,
//               _class: 'Finding',
//               displayName: findingDisplayName,
//               name: findingDisplayName,
//               qid: detection.QID!,
//               type: detection.TYPE,
//               severity: convertNumericSeverityToString(detection.SEVERITY),
//               numericSeverity: detection.SEVERITY!,
//               firstFoundOn: parseTimePropertyValue(
//                 detection.FIRST_FOUND_DATETIME,
//               ),
//               lastFoundOn: parseTimePropertyValue(
//                 detection.LAST_FOUND_DATETIME,
//               ),
//               numTimesFound: detection.TIMES_FOUND,
//               isDisabled: detection.IS_DISABLED,
//               lastProcessedOn: parseTimePropertyValue(
//                 detection.LAST_PROCESSED_DATETIME,
//               ),
//               port: detection.PORT,
//               protocol: detection.PROTOCOL,
//               ssl: detection.SSL,
//               status: detection.STATUS,
//               lastTestedOn: parseTimePropertyValue(
//                 detection.LAST_TEST_DATETIME,
//               ),
//               lastUpdatedOn: parseTimePropertyValue(
//                 detection.LAST_UPDATE_DATETIME,
//               ),
//               isIgnored: detection.IS_IGNORED,

//               category: 'system-scan',
//               open: true,

//               // TODO: These are required but not sure what values to use
//               production: true,
//               public: true,
//             },
//           },
//         }),
//       );

//       if (isHostEC2Instance()) {
//         hostHasFindingRelationship = createMappedRelationship({
//           _class: RelationshipClass.HAS,
//           _mapping: {
//             relationshipDirection: RelationshipDirection.FORWARD,
//             sourceEntityKey: findingEntity._key,
//             skipTargetCreation: false,
//             targetFilterKeys: [['_type', 'instanceId']],
//             targetEntity: {
//               _type: 'aws_instance',
//               instanceId: hostEntityLookupEntry.ec2InstanceId,
//             },
//           },
//         });
//       } else {
//         hostHasFindingRelationship = createDirectRelationship({
//           fromKey: hostEntityLookupEntry._key,
//           toKey: findingEntity._key,
//           fromType: TYPE_QUALYS_HOST,
//           toType: TYPE_QUALYS_HOST_FINDING,
//           _class: RelationshipClass.HAS,
//         });
//       }
//     }
//   });
// }

// function isHostEC2Instance(hostAsset: listHostAssetsTypes.HostAsset): boolean {
//   const ec2 = hostAsset.sourceInfo?.list?.Ec2AssetSourceSimple;
//   return !!(ec2 && ec2.type === 'EC_2' && ec2.instanceId);
// }

// async function findOrCreateHostEntityForDetectionHost(
//   jobState: JobState,
//   host: Host,
// ): Promise<Entity> {
//   const qwebHostId = host.ID!;
//   const hostKey = buildHostKey({
//     qwebHostId,
//   });

//   const entity = await jobState.findEntity(hostKey);
//   if (entity) {
//     return entity;
//   } else {
//     const hostname = host.DNS || host.NETBIOS || host.IP!;
//     return jobState.addEntity(
//       createIntegrationEntity({
//         entityData: {
//           source: host,
//           assign: {
//             _type: TYPE_QUALYS_HOST,
//             _key: hostKey,
//             _class: 'Host',
//             name: hostname,
//             displayName: hostname,
//             hostname,
//             hostId: qwebHostId,
//             os: host.OS,
//             lastScannedOn: parseTimePropertyValue(host.LAST_SCAN_DATETIME),
//             assetId: undefined,
//             fqdn: undefined,
//             platform: undefined,
//           },
//         },
//       }),
//     );
//   }
// }

export const hostSteps: IntegrationStep<QualysIntegrationConfig>[] = [
  {
    id: 'fetch-host-ids',
    name: 'Fetch Hosts IDs',
    entities: [],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchHostIds,
  },
  {
    id: 'fetch-host-vulns',
    name: 'Fetch Host Vulnerabilities',
    entities: [
      {
        _type: TYPE_QUALYS_HOST,
        _class: 'Host',
        resourceName: 'Host',
      },
    ],
    relationships: [],
    dependsOn: ['fetch-host-ids'],
    executionHandler: fetchHostVulnerabilities,
  },
];
