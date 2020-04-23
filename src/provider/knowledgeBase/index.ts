import QualysClient, {
  QualysClientResponseType,
  buildPaginatedResponse,
} from '../QualysClient';
import { ListQualysVulnerabilitiesReply } from './types.listQualysVulnerabilities';

export class QualysKnowledgeBaseClient {
  constructor(private qualysClient: QualysClient) {}

  async listQualysVulnerabilities(options: {
    qidList: number[];
    limit: number;
  }) {
    let index = 0;

    const buildUrl = (startIndex: number) => {
      const ids = options.qidList.slice(startIndex, startIndex + options.limit);
      return this.qualysClient.buildRequestUrl({
        path: '/api/2.0/fo/knowledge_base/vuln',
        query: {
          action: 'list',
          ids: ids.join(','),
        },
      });
    };

    return buildPaginatedResponse<ListQualysVulnerabilitiesReply>(
      this.qualysClient,
      {
        requestOptions: {
          requestName: 'knowledgeBase.listQualysVulnerabilities',
          url: buildUrl(index),
          method: 'get',
          responseType: QualysClientResponseType.XML,
        },
        buildNextRequest(result) {
          index += options.limit;
          return index >= options.qidList.length
            ? null
            : {
                url: buildUrl(index),
              };
        },
      },
    );
  }
}
