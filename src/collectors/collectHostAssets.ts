import { IntegrationStepExecutionContext } from '@jupiterone/integration-sdk-core';

import { convertHostAssetToEntity, isHostEC2Instance } from '../converters';
import { HostEntity } from '../converters/types';
import QualysClient from '../provider/QualysClient';
import toArray from '../util/toArray';

export default async function collectHostAssets(
  context: IntegrationStepExecutionContext,
  options: {
    qualysClient: QualysClient;
  },
): Promise<{ hostEntityLookup: Record<string, HostEntity> }> {
  const { logger } = context;

  logger.info('Collecting host assets...');

  const { qualysClient } = options;
  const hostEntityLookup: Record<string, HostEntity> = {};
  const hostAssetsPaginator = qualysClient.assetManagement.listHostAssets({
    limit: 10,
  });

  let pageIndex = 0;

  do {
    logger.info('Fetching page of host assets...');

    const { responseData } = await hostAssetsPaginator.nextPage();
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
          const hostEntity = convertHostAssetToEntity({
            hostAsset,
          });
          hostEntityLookup[hostEntity.hostId] = hostEntity;
          if (!isHostEC2Instance(hostEntity)) {
            hostEntities.push(hostEntity);
          }
        }
      }
      await context.jobState.addEntities(hostEntities);
    } else if (pageIndex === 0) {
      logger.info(
        {
          responseData,
        },
        'No data in listHostAssets',
      );
    }

    pageIndex++;
  } while (hostAssetsPaginator.hasNextPage());

  logger.info('Finished collecting host assets');

  return {
    hostEntityLookup,
  };
}
