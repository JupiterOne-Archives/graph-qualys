import QualysClient from '../provider/QualysClient';
import {
  IntegrationStepExecutionContext,
  createIntegrationRelationship,
} from '@jupiterone/integration-sdk';
import {
  convertWebAppVulnerabilityToFinding,
  TYPE_QUALYS_WEB_APP,
  TYPE_QUALYS_WEB_APP_FINDING,
  TYPE_QUALYS_VULN,
  buildQualysVulnKey,
  buildWebAppKey,
} from '../converters';
import toArray from '../util/toArray';
import QualysVulnEntityManager from './QualysVulnEntityManager';
import pMap from 'p-map';

export default async function collectWebAppScans(
  context: IntegrationStepExecutionContext,
  options: {
    qualysClient: QualysClient;
    webAppScanIdSet: Set<number>;
    qualysVulnEntityManager: QualysVulnEntityManager;
  },
) {
  const { logger } = context;

  logger.info('Collecting web app scans...');

  const { qualysClient, webAppScanIdSet, qualysVulnEntityManager } = options;
  await pMap(
    webAppScanIdSet,
    async (webAppScanId) => {
      const {
        responseData,
      } = await qualysClient.webApplicationScanning.fetchScanResults({
        webAppScanId,
      });

      const targetWebApp = responseData.WasScan?.target?.webApp;
      const vulns = toArray(responseData.WasScan?.vulns?.list?.WasScanVuln);
      for (const vuln of vulns) {
        if (vuln.qid !== undefined && targetWebApp) {
          qualysVulnEntityManager.addQID(vuln.qid);
        }
      }

      for (const vuln of vulns) {
        if (targetWebApp && vuln.qid) {
          const webAppFindingEntity = convertWebAppVulnerabilityToFinding({
            vuln,
            webApp: targetWebApp,
            vulnFromKnowledgeBase: await qualysVulnEntityManager.getVulnerabilityByQID(
              vuln.qid!,
            ),
          });

          // Create the Finding
          await context.jobState.addEntities([webAppFindingEntity]);

          // Relate the Web App to the Finding
          const webAppHasFinding = createIntegrationRelationship({
            fromKey: buildWebAppKey({
              webAppId: targetWebApp.id!,
            }),
            toKey: webAppFindingEntity._key,
            fromType: TYPE_QUALYS_WEB_APP,
            toType: TYPE_QUALYS_WEB_APP_FINDING,
            _class: 'HAS',
          });
          await context.jobState.addRelationships([webAppHasFinding]);

          // Relate the Finding to the Vulnerability
          const webAppFindingIsVuln = createIntegrationRelationship({
            fromKey: webAppFindingEntity._key,
            toKey: buildQualysVulnKey({
              qid: vuln.qid,
            }),
            fromType: TYPE_QUALYS_WEB_APP_FINDING,
            toType: TYPE_QUALYS_VULN,
            _class: 'IS',
          });
          await context.jobState.addRelationships([webAppFindingIsVuln]);
        }
      }
    },
    {
      concurrency: 5,
    },
  );

  logger.info('Finished collecting web app scans');
}
