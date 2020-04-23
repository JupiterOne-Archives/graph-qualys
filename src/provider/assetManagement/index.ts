import type QualysClient from '../QualysClient';
import { buildRestApiPaginator } from '../paginationUtil';
import { ListHostAssetsReply } from './types.listHostAssets';

export class QualysAssetManagementClient {
  constructor(private qualysClient: QualysClient) {}

  listHostAssets(options: { limit: number }) {
    const { limit } = options;
    const url = this.qualysClient.buildRequestUrl({
      path: '/qps/rest/2.0/search/am/hostasset',
    });

    return buildRestApiPaginator<ListHostAssetsReply>(this.qualysClient, {
      requestOptions: {
        requestName: 'assetManagement.listHostAssets',
        url,
      },
      paginationOptions: {
        limit,
      },
    });
  }
}
