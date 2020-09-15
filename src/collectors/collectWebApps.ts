import pMap from 'p-map';

import { IntegrationStepExecutionContext } from '@jupiterone/integration-sdk-core';

import { convertWebAppToEntity } from '../converters';
import QualysClient from '../provider/QualysClient';
import { wrapMapFunctionWithInvokeSafely } from '../util/errorHandlerUtil';
import toArray from '../util/toArray';

export default async function collectWebApps(
  context: IntegrationStepExecutionContext,
  options: {
    qualysClient: QualysClient;
  },
): Promise<{ webAppScanIdSet: Set<number> }> {
  const { logger } = context;

  logger.info('Collecting web apps...');

  const { qualysClient } = options;

  const paginator = await qualysClient.webApplicationScanning.listWebApps({
    limit: 1000,
    isScanned: true,
  });

  const webAppScanIdSet = new Set<number>();
  // const webAppWork: PromiseFactory<void>[] = [];
  const webAppIds: number[] = [];

  let pageIndex = 0;

  do {
    logger.info('Fetching page of web apps...');

    const { responseData } = await paginator.nextPage();

    const webApps = toArray(responseData.ServiceResponse?.data?.WebApp);

    if (webApps.length) {
      logger.info(
        {
          numWebApps: webApps.length,
        },
        'Fetched page of web apps',
      );

      for (const webApp of webApps) {
        webAppIds.push(webApp.id!);
        await context.jobState.addEntity(convertWebAppToEntity({ webApp }));
      }
    } else if (pageIndex === 0) {
      logger.info(
        {
          responseData,
        },
        'No data in listWebApps',
      );
    }

    pageIndex++;
  } while (paginator.hasNextPage());

  const collectWebAppScanIds = wrapMapFunctionWithInvokeSafely(
    context,
    {
      operationName: 'collectWebAppScanIds',
    },
    async (webAppId: number) => {
      const {
        responseData,
      } = await qualysClient.webApplicationScanning.fetchWebApp({
        webAppId: webAppId,
      });

      const lastScanId =
        responseData.ServiceResponse?.data?.WebApp?.lastScan?.id;
      if (lastScanId !== undefined) {
        webAppScanIdSet.add(lastScanId);
      }
    },
  );

  await pMap(webAppIds, collectWebAppScanIds, {
    concurrency: 1,
  });

  logger.info('Finished collecting web apps');

  return {
    webAppScanIdSet,
  };
}
