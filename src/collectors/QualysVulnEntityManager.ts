import { IntegrationStepExecutionContext } from '@jupiterone/integration-sdk-core';

import { convertQualysVulnerabilityToEntity } from '../converters';
import { QualysVulnerabilityEntity } from '../converters/types';
import { QualysVulnerabilitiesErrorResponse } from '../provider/knowledgeBase/types.listQualysVulnerabilities';
import QualysClient from '../provider/QualysClient';
import { wrapFunctionWithInvokeSafely } from '../util/errorHandlerUtil';
import toArray from '../util/toArray';
import pAll from 'p-all';

function mapChunks<I, O>(
  arr: I[],
  chunkSize: number,
  chunkHandler: (chunk: I[], startIndex: number) => O,
): O[] {
  const results: O[] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    results.push(chunkHandler(chunk, i));
  }
  return results;
}

export default class QualysVulnEntityManager {
  context: IntegrationStepExecutionContext;
  unfetchedQidSet = new Set<number>();
  fetchedVulnMap = new Map<number, QualysVulnerabilityEntity>();
  qualysClient: QualysClient;
  fetchNotAllowed = false;
  fetchMissingVulnerabilities: () => Promise<void>;

  constructor(options: {
    context: IntegrationStepExecutionContext;
    qualysClient: QualysClient;
  }) {
    const context = (this.context = options.context);
    this.qualysClient = options.qualysClient;

    this.fetchMissingVulnerabilities = wrapFunctionWithInvokeSafely(
      options.context,
      {
        operationName: 'fetchMissingVulnerabilities',
      },
      async () => {
        if (!this.unfetchedQidSet.size || this.fetchNotAllowed) {
          return;
        }

        const { logger } = context;

        const qidListToFetch = [...this.unfetchedQidSet];

        this.unfetchedQidSet.clear();

        const chunkSize = 200;

        await pAll(
          mapChunks(qidListToFetch, chunkSize, (qidListChunk) => {
            return async () => {
              const qualysVulnPaginator = await this.qualysClient.knowledgeBase.listQualysVulnerabilities(
                {
                  limit: chunkSize,
                  qidList: qidListChunk,
                },
              );

              // There should be only one page of vulnerabilities returned
              // since the chunk size and limit have the same value but
              // loop through the pages just in case.
              do {
                const nextRequest = qualysVulnPaginator.getNextRequest()!;
                const { pageIndex, cursor, logData } = nextRequest;
                logger.info(
                  {
                    ...logData,
                    pageIndex,
                    cursor,
                    qidListLength: qidListChunk.length,
                  },
                  'Fetching vulnerabilities from knowledge base...',
                );

                const { responseData } = await qualysVulnPaginator.nextPage(
                  context,
                );

                const errorResponse = responseData as Partial<
                  QualysVulnerabilitiesErrorResponse
                >;
                if (errorResponse.SIMPLE_RETURN?.RESPONSE?.CODE === 2010) {
                  // Check for reply that looks like this:
                  // {
                  //   "SIMPLE_RETURN": {
                  //     "RESPONSE": {
                  //       "DATETIME": "2020-05-01T01:10:13Z",
                  //       "CODE": 2010,
                  //       "TEXT": "You are not allowed to download the KnowledgeBase, please contact your sales representative for more information."
                  //     }
                  //   }
                  // }
                  context.logger.error(
                    errorResponse.SIMPLE_RETURN.RESPONSE.TEXT ||
                      'Unable to fetch from knowledge base (will not try again)',
                  );
                  this.fetchNotAllowed = true;
                  break;
                }

                const vulnList = toArray(
                  responseData.KNOWLEDGE_BASE_VULN_LIST_OUTPUT?.RESPONSE
                    ?.VULN_LIST?.VULN,
                );

                logger.info(
                  {
                    numVulns: vulnList.length,
                    pageIndex,
                  },
                  'Fetched page of vulnerabilities',
                );

                const entities: QualysVulnerabilityEntity[] = [];

                for (const vuln of vulnList) {
                  const entity = convertQualysVulnerabilityToEntity({
                    vuln,
                  });
                  this.fetchedVulnMap.set(entity.qid, entity);
                  entities.push(entity);
                }

                // Add the vulnerabilities to synchronization job
                await context.jobState.addEntities(entities);
              } while (qualysVulnPaginator.hasNextPage());
            };
          }),
        );

        logger.info(
          {
            qidListLength: qidListToFetch.length,
          },
          'Finished fetching vulnerabilities from knowledge base',
        );
      },
    );
  }

  addQID(qid: number): void {
    // safety check because we're dealing with some inconsistent APIs
    if (qid == null || this.fetchNotAllowed) {
      return;
    }

    if (!this.fetchedVulnMap.has(qid)) {
      this.unfetchedQidSet.add(qid);
    }
  }

  async getVulnerabilityByQID(
    qid: number,
  ): Promise<QualysVulnerabilityEntity | undefined> {
    const existing = this.fetchedVulnMap.get(qid);
    if (existing) {
      return existing;
    }

    this.unfetchedQidSet.add(qid);

    await this.fetchMissingVulnerabilities();

    return this.fetchedVulnMap.get(qid);
  }
}
