import {
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk';
import { QualysVulnerabilityEntity } from '../converters/types';
import QualysClient from '../provider/QualysClient';
import toArray from '../util/toArray';
import { convertQualysVulnerabilityToEntity } from '../converters';
import { QualysVulnerabilitiesErrorResponse } from '../provider/knowledgeBase/types.listQualysVulnerabilities';

export default class QualysVulnEntityManager {
  context: IntegrationStepExecutionContext;
  unfetchedQidSet = new Set<number>();
  fetchedVulnMap = new Map<number, QualysVulnerabilityEntity>();
  qualysClient: QualysClient;
  fetchNotAllowed = false;

  constructor(options: {
    context: IntegrationStepExecutionContext;
    qualysClient: QualysClient;
  }) {
    this.context = options.context;
    this.qualysClient = options.qualysClient;
  }

  addQID(qid: number) {
    // safety check because we're dealing with some inconsistent APIs
    if (qid == null || this.fetchNotAllowed) {
      return;
    }

    if (!this.fetchedVulnMap.has(qid)) {
      this.unfetchedQidSet.add(qid);
    }
  }

  private async fetchMissingVulnerabilities() {
    if (!this.unfetchedQidSet.size || this.fetchNotAllowed) {
      return;
    }

    const { logger } = this.context;

    logger.info('Fetching vulnerabilities from knowledge base...');

    const qidListToFetch = [...this.unfetchedQidSet];

    this.unfetchedQidSet.clear();

    const qualysVulnPaginator = await this.qualysClient.knowledgeBase.listQualysVulnerabilities(
      {
        limit: 200,
        qidList: qidListToFetch,
      },
    );

    do {
      const { responseData } = await qualysVulnPaginator.nextPage();

      const errorResponse = (responseData as Partial<QualysVulnerabilitiesErrorResponse>);
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
        this.context.logger.error(errorResponse.SIMPLE_RETURN.RESPONSE.TEXT || 'Unable to fetch from knowledge base (will not try again)');
        this.fetchNotAllowed = true;
        break;
      }

      const vulnList = toArray(
        responseData.KNOWLEDGE_BASE_VULN_LIST_OUTPUT?.RESPONSE?.VULN_LIST?.VULN,
      );

      const entities: QualysVulnerabilityEntity[] = [];

      for (const vuln of vulnList) {
        const entity = convertQualysVulnerabilityToEntity({
          vuln,
        });

        this.fetchedVulnMap.set(entity.qid, entity);

        entities.push(entity);
      }
    } while (qualysVulnPaginator.hasNextPage());

    logger.info('Finished fetching vulnerabilities from knowledge base');
  }

  async getVulnerabilityByQID(qid: number) {
    const existing = this.fetchedVulnMap.get(qid);
    if (existing) {
      return existing;
    }

    this.unfetchedQidSet.add(qid);

    await this.fetchMissingVulnerabilities();

    return this.fetchedVulnMap.get(qid);
  }

  async getCollectedVulnerabilities() {
    await this.fetchMissingVulnerabilities();
    return [...this.fetchedVulnMap.values()];
  }
}
