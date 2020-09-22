import QualysClient, {
  buildQualysClientPaginator,
  QualysApiResponsePaginator,
  QualysClientResponseType,
} from '../QualysClient';
import { ListQualysVulnerabilitiesReply } from './types.listQualysVulnerabilities';
import { buildRetryOptions } from '../paginationUtil';

export class QualysKnowledgeBaseClient {
  constructor(private qualysClient: QualysClient) {}

  async listQualysVulnerabilities(options: {
    qidList: number[];
    limit: number;
  }): Promise<QualysApiResponsePaginator<ListQualysVulnerabilitiesReply>> {
    let index = 0;
    let limit = options.limit;
    const { maxAttempts, limitDecrease } = buildRetryOptions({
      limit,
      maxAttempts: 5,
    });

    const buildUrl = (startIndex: number, limit: number) => {
      const ids = options.qidList.slice(startIndex, startIndex + limit);
      return this.qualysClient.buildRequestUrl({
        apiUrl: process.env.QUALYS_KNOWLEDGE_BASE_API_URL,
        path: '/api/2.0/fo/knowledge_base/vuln',
        query: {
          action: 'list',
          ids: ids.join(','),
        },
      });
    };

    return buildQualysClientPaginator<ListQualysVulnerabilitiesReply>(
      this.qualysClient,
      {
        requestName: 'knowledgeBase.listQualysVulnerabilities',
        url: buildUrl(index, limit),
        method: 'get',
        maxAttempts,
        logData: { limit },
        responseType: QualysClientResponseType.XML,
        buildPageRequestToRetryAfterTimeout(context, lastResponse) {
          limit = Math.max(100, limit - limitDecrease);
          context.logger.warn(
            { limit },
            'Adjusted pagination limit after timeout',
          );
          return {
            url: buildUrl(index, limit),
            cursor: index.toString(),
            lastResponse,
            logData: { limit },
          };
        },
        buildNextPageRequest(context, lastResponse) {
          index += limit;
          return index >= options.qidList.length
            ? null
            : {
                url: buildUrl(index, limit),
                cursor: index.toString(),
                lastResponse,
                logData: { limit },
              };
        },
      },
    );
  }
}
