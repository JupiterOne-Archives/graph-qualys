import {
  IntegrationStepExecutionContext, createIntegrationEntity,
} from '@jupiterone/integration-sdk';
import QualysVulnEntityManager from './QualysVulnEntityManager';

export default async function collectVulnerabilities(
  context: IntegrationStepExecutionContext,
  options: {
    qualysVulnEntityManager: QualysVulnEntityManager;
  },
) {
  const { logger } = context;
  const { qualysVulnEntityManager } = options;

  logger.info('Collecting Qualys vulnerabilities...');

  const entities = await qualysVulnEntityManager.getCollectedVulnerabilities();

  if (qualysVulnEntityManager.fetchNotAllowed) {
    // TODO: record that _type failed for Qualys vulnerabilities
  }

  if (entities.length === 0) {
    context.logger.info('No Qualys vulnerabilities were collected');
    return;
  }

  await context.jobState.addEntities(
    entities.map((entity) => {
      return createIntegrationEntity({
        entityData: {
          source: {},
          assign: entity,
        },
      });
    }),
  );

  logger.info('Finished collecting Qualys vulnerabilities');
}
