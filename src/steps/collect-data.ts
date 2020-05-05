import {
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk';
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

const step: IntegrationStep = {
  id: 'collect-data',
  name: 'Collect Data',

  types: [
    TYPE_QUALYS_WEB_APP,
    TYPE_QUALYS_HOST_FINDING,
    TYPE_QUALYS_WEB_APP_FINDING,
    TYPE_QUALYS_VULN,
    TYPE_QUALYS_HOST,
  ],

  async executionHandler(context: IntegrationStepExecutionContext) {
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

      const { webAppScanIdSet } = await collectWebApps(context, {
        qualysClient,
      });

      await collectWebAppScans(context, {
        qualysClient,
        qualysVulnEntityManager,
        webAppScanIdSet,
      });

      const { hostAssetIdSet } = await collectHostAssets(context, {
        qualysClient,
      });

      await collectHostDetections(context, {
        qualysClient,
        qualysVulnEntityManager,
        hostAssetIdSet,
      });

      await collectVulnerabilities(context, {
        qualysVulnEntityManager
      });
    } finally {
      httpRecorder?.close();
    }
  },
};

export default step;
