import { IntegrationStep } from '@jupiterone/integration-sdk';
import QualysClient from '../provider/QualysClient';
import { QualysIntegrationConfig } from '../types';
import {
  TYPE_QUALYS_VULN,
  TYPE_QUALYS_WEB_APP,
  TYPE_QUALYS_HOST_FINDING,
  TYPE_QUALYS_WEB_APP_FINDING,
  TYPE_QUALYS_HOST,
} from '../converters';
import collectHostAssets from '../collectors/collectHostAssets';
import collectHostDetections from '../collectors/collectHostDetections';
import collectWebAppScans from '../collectors/collectWebAppScans';
import collectWebApps from '../collectors/collectWebApps';
import collectVulnerabilities from '../collectors/collectVulnerabilities';
import QualysVulnEntityManager from '../collectors/QualysVulnEntityManager';
import { QualysHttpRecorder } from '../provider/QualysHttpRecorder';
import { invokeSafely } from '../util/errorHandlerUtil';

const step: IntegrationStep<QualysIntegrationConfig> = {
  id: 'collect-data',
  name: 'Collect Data',

  types: [
    TYPE_QUALYS_WEB_APP,
    TYPE_QUALYS_HOST_FINDING,
    TYPE_QUALYS_WEB_APP_FINDING,
    TYPE_QUALYS_VULN,
    TYPE_QUALYS_HOST,
  ],

  async executionHandler(context) {
    const config: QualysIntegrationConfig = context.instance.config;

    const httpRecorder =
      process.env.RECORD_HTTP === 'true'
        ? new QualysHttpRecorder({
            recordingDir: await QualysHttpRecorder.createHttpRecordingDir(
              '.http-recordings',
            ),
            logToConsole: true,
          })
        : undefined;

    try {
      const qualysClient = new QualysClient({
        apiUrl: config.qualysApiUrl,
        username: config.qualysUsername,
        password: config.qualysPassword,
        onResponse(requestResponse) {
          if (httpRecorder) {
            httpRecorder.logRequest(requestResponse);
          }
        },
      });

      const qualysVulnEntityManager = new QualysVulnEntityManager({
        context,
        qualysClient,
      });

      const collectWebAppsResult = await invokeSafely(
        context,
        { operationName: 'collectWebApps' },
        async () => {
          return collectWebApps(context, {
            qualysClient,
          });
        },
      );

      await invokeSafely(
        context,
        { operationName: 'collectWebAppScans' },
        async () => {
          await collectWebAppScans(context, {
            qualysClient,
            qualysVulnEntityManager,
            webAppScanIdSet: collectWebAppsResult?.webAppScanIdSet || new Set(),
          });
        },
      );

      const collectHostAssetsResult = await invokeSafely(
        context,
        { operationName: 'collectHostAssets' },
        async () => {
          return collectHostAssets(context, {
            qualysClient,
          });
        },
      );

      await invokeSafely(
        context,
        { operationName: 'collectHostDetections' },
        async () => {
          await collectHostDetections(context, {
            qualysClient,
            qualysVulnEntityManager,
            hostEntityLookup: collectHostAssetsResult?.hostEntityLookup || {},
          });
        },
      );

      await invokeSafely(
        context,
        { operationName: 'collectVulnerabilities' },
        async () => {
          await collectVulnerabilities(context, {
            qualysVulnEntityManager,
          });
        },
      );
    } finally {
      httpRecorder?.close();
    }
  },
};

export default step;
