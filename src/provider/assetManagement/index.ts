import type QualysClient from '../QualysClient';
import type { QualysApiResponsePaginator } from '../QualysClient';
import { buildRestApiPaginator } from '../paginationUtil';
import { ListHostAssetsReply } from './types.listHostAssets';

export class QualysAssetManagementClient {
  constructor(private qualysClient: QualysClient) {}

  listHostAssets(options: {
    limit: number;
    lastVulnScanAfter: Date;
  }): QualysApiResponsePaginator<ListHostAssetsReply> {
    const { lastVulnScanAfter } = options;
    const url = this.qualysClient.buildRequestUrl({
      path: '/qps/rest/2.0/search/am/hostasset',
    });

    return buildRestApiPaginator<ListHostAssetsReply>(this.qualysClient, {
      requestName: 'assetManagement.listHostAssets',
      url,
      limit: options.limit,
      maxAttempts: 5,
      constraints: {
        dateAfterFilters: {
          lastVulnScan: lastVulnScanAfter,
        },
      },
    });
  }
}
