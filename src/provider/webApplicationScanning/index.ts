import QualysClient, {
  QualysApiResponsePaginator,
  QualysApiRequestResponse,
} from '../QualysClient';
import { buildRestApiPaginator } from '../paginationUtil';
import { QualysClientResponseType } from '../QualysClient';
import { FetchScanResultsReply } from './types.fetchScanResults';
import { FetchWebAppReply } from './types.fetchWebApp';
import { ListWebAppsReply } from './types.listWebApps';

export class QualysWebApplicationScanningClient {
  constructor(private qualysClient: QualysClient) {}

  listScans(options: { limit: number }): QualysApiResponsePaginator<any> {
    const { limit } = options;
    const url = this.qualysClient.buildRequestUrl({
      path: '/qps/rest/3.0/search/was/wasscan',
    });

    return buildRestApiPaginator(this.qualysClient, {
      requestOptions: {
        requestName: 'webApplicationScanning.listScans',
        url,
      },
      paginationOptions: {
        limit,
      },
    });
  }

  listWebApps(options: {
    limit: number;
    isScanned: true;
  }): QualysApiResponsePaginator<ListWebAppsReply> {
    const { limit, isScanned } = options;
    const url = this.qualysClient.buildRequestUrl({
      path: '/qps/rest/3.0/search/was/webapp',
    });

    const filters = {
      isScanned,
    };

    return buildRestApiPaginator<ListWebAppsReply>(this.qualysClient, {
      requestOptions: {
        requestName: 'webApplicationScanning.listWebApps',
        url,
      },
      paginationOptions: {
        limit,
        filters,
      },
    });
  }

  async fetchWebApp(options: {
    webAppId: number;
  }): Promise<QualysApiRequestResponse<FetchWebAppReply>> {
    return this.qualysClient.makeRequest<FetchWebAppReply>({
      requestName: 'webApplicationScanning.fetchWebApp',
      path: `/qps/rest/3.0/get/was/webapp/${options.webAppId}`,
      method: 'get',
      headers: {
        'Content-Type': 'text/xml',
      },
      responseType: QualysClientResponseType.XML,
    });
  }

  // async fetchScanDetails(options: {
  //   webAppScanId: number
  // }): Promise<QualysApiRequestResponse<any>> {
  //   return this.qualysClient.makeRequest({
  //     requestName: 'webApplicationScanning.fetchScanDetails',
  //     path: `/qps/rest/3.0/get/was/wasscan/${options.webAppScanId}`,
  //     method: 'get',
  //     headers: {
  //       'Content-Type': 'text/xml',
  //     },
  //     responseType: QualysClientResponseType.XML
  //   });
  // }

  async fetchScanResults(options: {
    webAppScanId: number;
  }): Promise<QualysApiRequestResponse<FetchScanResultsReply>> {
    return this.qualysClient.makeRequest<FetchScanResultsReply>({
      requestName: 'webApplicationScanning.fetchScanResults',
      path: `/qps/rest/3.0/download/was/wasscan/${options.webAppScanId}`,
      method: 'get',
      headers: {
        'Content-Type': 'text/xml',
      },
      responseType: QualysClientResponseType.XML,
    });
  }
}
