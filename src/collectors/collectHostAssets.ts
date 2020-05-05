import { IntegrationStepExecutionContext } from '@jupiterone/integration-sdk';
import QualysClient from '../provider/QualysClient';
import toArray from '../util/toArray';
import { HostEntity } from '../converters/types';
import { convertHostAssetToEntity } from '../converters';

export default async function collectHostAssets(
  context: IntegrationStepExecutionContext,
  options: {
    qualysClient: QualysClient;
  },
) {
  const { logger } = context;

  logger.info('Collecting host assets...');

  const { qualysClient } = options;
  const hostAssetIdSet = new Set<number>();
  const hostAssetsPaginator = qualysClient.assetManagement.listHostAssets({
    limit: 10,
  });

  let pageIndex = 0;

  do {
    const { responseData } = await hostAssetsPaginator.nextPage();
    const hostAssets = toArray(responseData?.ServiceResponse?.data?.HostAsset);
    const hostEntities: HostEntity[] = [];
    if (hostAssets.length) {
      for (const hostAsset of hostAssets) {
        const qwebHostId = hostAsset.qwebHostId;
        if (qwebHostId) {
          const hostEntity = convertHostAssetToEntity({
            hostAsset,
          });
          hostAssetIdSet.add(hostEntity.hostId);
          hostEntities.push(hostEntity);
        }
      }
      await context.jobState.addEntities(hostEntities);
    } else if (pageIndex === 0) {
      logger.info({
        responseData
      }, 'No data in listHostAssets');
    }

    pageIndex++;
  } while (hostAssetsPaginator.hasNextPage());

  logger.info('Finished collecting host assets');

  return {
    hostAssetIdSet,
  };
}
