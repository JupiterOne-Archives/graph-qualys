import { IntegrationStepExecutionContext } from '@jupiterone/integration-sdk-core';

import { convertHostAssetToEntity, isHostEC2Instance } from '../converters';
import { HostEntity } from '../converters/types';
import QualysClient from '../provider/QualysClient';
import toArray from '../util/toArray';

const MILLISECONDS_ONE_DAY = 86400000;
const MAX_LAST_SCAN_AGE = 7 * MILLISECONDS_ONE_DAY;

export type HostEntityLookupEntry = {
  _key: string;
  hostId: number;
  ec2InstanceId?: string;
};

export function convertHostEntityForLookup(
  hostEntity: HostEntity,
): HostEntityLookupEntry {
  const isEC2 = isHostEC2Instance(hostEntity);
  const entry: HostEntityLookupEntry = {
    _key: hostEntity._key,
    hostId: hostEntity.hostId,
    ec2InstanceId: isEC2 ? hostEntity.instanceId : undefined,
  };
  return entry;
}

export default async function collectHostAssets(
  context: IntegrationStepExecutionContext,
  options: {
    qualysClient: QualysClient;
  },
): Promise<{ hostEntityLookup: Record<string, HostEntityLookupEntry> }> {
  const { logger } = context;

  logger.info('Collecting host assets...');

  const { qualysClient } = options;
  const hostEntityLookup: Record<string, HostEntityLookupEntry> = {};

  const hostAssetsPaginator = qualysClient.assetManagement.listHostAssets({
    // limit is automatically reduced when timeout occurs
    limit: 375,
    lastVulnScanAfter: new Date(Date.now() - MAX_LAST_SCAN_AGE),
  });

  let totalNumHostAssets = 0;

  do {
    const nextRequest = hostAssetsPaginator.getNextRequest()!;
    const { pageIndex, cursor, logData } = nextRequest;
    logger.info(
      {
        ...logData,
        url: nextRequest.url,
        cursor,
        pageIndex,
        totalNumHostAssets,
      },
      'Fetching page of host assets...',
    );

    const { responseData } = await hostAssetsPaginator.nextPage(context);
    const hostAssets = toArray(responseData?.ServiceResponse?.data?.HostAsset);
    const hostEntities: HostEntity[] = [];
    if (hostAssets.length) {
      logger.info(
        {
          numHostAssets: hostAssets.length,
          pageIndex,
        },
        'Fetched page of host assets',
      );
      for (const hostAsset of hostAssets) {
        const qwebHostId = hostAsset.qwebHostId;
        if (qwebHostId) {
          totalNumHostAssets++;
          const hostEntity = convertHostAssetToEntity({
            hostAsset,
          });

          // Only store a trimmed down entry in the lookup table
          const lookupEntry = convertHostEntityForLookup(hostEntity);
          hostEntityLookup[hostEntity.hostId] = lookupEntry;

          if (!lookupEntry.ec2InstanceId) {
            hostEntities.push(hostEntity);
          }
        }
      }
      await context.jobState.addEntities(hostEntities);
      await context.jobState.flush();
    } else if (pageIndex === 0) {
      logger.info(
        {
          responseData,
        },
        'No data in listHostAssets',
      );
    }
  } while (hostAssetsPaginator.hasNextPage());

  logger.info({ totalNumHostAssets }, 'Finished collecting host assets');

  return {
    hostEntityLookup,
  };
}
