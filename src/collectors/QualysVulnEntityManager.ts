import {
  IntegrationStepExecutionContext,
  createIntegrationEntity,
} from '@jupiterone/integration-sdk';
import { QualysVulnerabilityEntity } from '../converters/types';
import QualysClient from '../provider/QualysClient';
import toArray from '../util/toArray';
import { convertQualysVulnerabilityToEntity } from '../converters';

export default class QualysVulnEntityManager {
  context: IntegrationStepExecutionContext;
  unfetchedQidSet = new Set<number>();
  fetchedVulnMap = new Map<number, QualysVulnerabilityEntity>();
  qualysClient: QualysClient;

  constructor(options: {
    context: IntegrationStepExecutionContext;
    qualysClient: QualysClient;
  }) {
    this.context = options.context;
    this.qualysClient = options.qualysClient;
  }

  addQID(qid: number) {
    // safety check because we're dealing with some inconsistent APIs
    if (qid == null) {
      return;
    }

    if (!this.fetchedVulnMap.has(qid)) {
      this.unfetchedQidSet.add(qid);
    }
  }

  private async fetchMissingVulnerabilities() {
    if (!this.unfetchedQidSet.size) {
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

  async saveVulnerabilities() {
    await this.fetchMissingVulnerabilities();

    const entities = [...this.fetchedVulnMap.values()];

    if (entities.length === 0) {
      return;
    }

    await this.context.jobState.addEntities(
      entities.map((entity) => {
        return createIntegrationEntity({
          entityData: {
            source: {},
            assign: entity,
          },
        });
      }),
    );
  }
}
