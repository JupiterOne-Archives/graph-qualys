import pMap from 'p-map';

import {
  createDirectRelationship,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import {
  buildQualysVulnKey,
  buildWebAppKey,
  convertWebAppVulnerabilityToFinding,
  TYPE_QUALYS_VULN,
  TYPE_QUALYS_WEB_APP,
  TYPE_QUALYS_WEB_APP_FINDING,
} from '../converters';
import QualysClient from '../provider/QualysClient';
import { wrapMapFunctionWithInvokeSafely } from '../util/errorHandlerUtil';
import toArray from '../util/toArray';
import QualysVulnEntityManager from './QualysVulnEntityManager';

export default async function collectWebAppScans(
  context: IntegrationStepExecutionContext,
  options: {
    qualysClient: QualysClient;
    webAppScanIdSet: Set<number>;
    qualysVulnEntityManager: QualysVulnEntityManager;
  },
): Promise<void> {
  const { logger } = context;

  logger.info('Collecting web app scans...');

  const { qualysClient, webAppScanIdSet, qualysVulnEntityManager } = options;

  const seenFindingEntityKeys = new Set<string>();

  const collectWebAppScan = wrapMapFunctionWithInvokeSafely(
    context,
    {
      operationName: 'collectWebAppScan',
    },
    async (webAppScanId: number) => {
      const {
        responseData,
      } = await qualysClient.webApplicationScanning.fetchScanResults({
        webAppScanId,
      });

      const targetWebApp = responseData.WasScan?.target?.webApp;
      if (targetWebApp) {
        const vulns = toArray(responseData.WasScan?.vulns?.list?.WasScanVuln);
        for (const vuln of vulns) {
          if (vuln.qid !== undefined) {
            qualysVulnEntityManager.addQID(vuln.qid);
          }
        }

        for (const vuln of vulns) {
          if (vuln.qid) {
            const webAppFindingEntity = convertWebAppVulnerabilityToFinding({
              vuln,
              webApp: targetWebApp,
              vulnFromKnowledgeBase: await qualysVulnEntityManager.getVulnerabilityByQID(
                vuln.qid!,
              ),
            });

            // Avoid duplicates by checking to see if we already have a Finding
            // for this webapp that is basically identical.
            if (seenFindingEntityKeys.has(webAppFindingEntity._key)) {
              continue;
            }

            seenFindingEntityKeys.add(webAppFindingEntity._key);

            // Create the Finding
            await context.jobState.addEntities([webAppFindingEntity]);

            // Relate the Web App to the Finding
            const webAppHasFinding = createDirectRelationship({
              fromKey: buildWebAppKey({
                webAppId: targetWebApp.id!,
              }),
              toKey: webAppFindingEntity._key,
              fromType: TYPE_QUALYS_WEB_APP,
              toType: TYPE_QUALYS_WEB_APP_FINDING,
              _class: RelationshipClass.HAS,
            });

            await context.jobState.addRelationships([webAppHasFinding]);

            // Relate the Finding to the Vulnerability
            const webAppFindingIsVuln = createDirectRelationship({
              fromKey: webAppFindingEntity._key,
              toKey: buildQualysVulnKey({
                qid: vuln.qid,
              }),
              fromType: TYPE_QUALYS_WEB_APP_FINDING,
              toType: TYPE_QUALYS_VULN,
              _class: RelationshipClass.IS,
            });
            await context.jobState.addRelationships([webAppFindingIsVuln]);
          }
        }
      } else {
        logger.info(
          {
            responseData,
          },
          'No data in fetchScanResults',
        );
      }
    },
  );

  await pMap(webAppScanIdSet, collectWebAppScan, {
    concurrency: 5,
  });

  logger.info('Finished collecting web app scans');
}
