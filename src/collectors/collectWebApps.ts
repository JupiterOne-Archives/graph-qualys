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
    // limit is automatically reduced when timeout occurs
    limit: 1000,
    isScanned: true,
  });

  const webAppScanIdSet = new Set<number>();
  // const webAppWork: PromiseFactory<void>[] = [];
  const webAppIds: number[] = [];

  do {
    const nextRequest = paginator.getNextRequest()!;
    const { pageIndex, cursor, logData } = nextRequest;
    logger.info(
      {
        ...logData,
        pageIndex,
        cursor,
      },
      'Fetching page of web apps...',
    );

    const { responseData } = await paginator.nextPage(context);

    const webApps = toArray(responseData.ServiceResponse?.data?.WebApp);

    if (webApps.length) {
      logger.info(
        {
          numWebApps: webApps.length,
          pageIndex,
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
  } while (paginator.hasNextPage());

  logger.info(
    {
      numWebApps: webAppIds.length,
    },
    'Finished fetching all web apps.',
  );

  logger.info(
    'Fetching each web app individually to collect "lastScanId" values...',
  );

  const collectWebAppScanIds = wrapMapFunctionWithInvokeSafely(
    context,
    {
      operationName: 'collectWebAppScanIds',
    },
    async (webAppId: number) => {
      logger.trace(
        {
          webAppId,
        },
        'Fetching web app to get "lastScanId"...',
      );
      const {
        responseData,
      } = await qualysClient.webApplicationScanning.fetchWebApp({
        webAppId: webAppId,
      });

      const lastScanId =
        responseData.ServiceResponse?.data?.WebApp?.lastScan?.id;
      if (lastScanId === undefined) {
        logger.trace(
          {
            webAppId,
          },
          'Web app does not have "lastScanId" (ignoring)',
        );
      } else {
        logger.trace(
          {
            webAppId,
            lastScanId,
          },
          'Fetched web app to get "lastScanId" and found a value',
        );
        webAppScanIdSet.add(lastScanId);
      }
    },
  );

  await pMap(webAppIds, collectWebAppScanIds, {
    concurrency: 10,
  });

  logger.info(
    {
      numWebApps: webAppIds.length,
      numWebAppScanIds: webAppScanIdSet.size,
    },
    'Finished collecting web apps and their "lastScanId" values',
  );

  return {
    webAppScanIdSet,
  };
}
