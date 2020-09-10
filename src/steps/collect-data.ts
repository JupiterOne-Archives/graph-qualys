import {
  IntegrationStep,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import collectHostAssets from '../collectors/collectHostAssets';
import collectHostDetections from '../collectors/collectHostDetections';
import collectVulnerabilities from '../collectors/collectVulnerabilities';
import collectWebApps from '../collectors/collectWebApps';
import collectWebAppScans from '../collectors/collectWebAppScans';
import QualysVulnEntityManager from '../collectors/QualysVulnEntityManager';
import {
  TYPE_QUALYS_HOST,
  TYPE_QUALYS_HOST_FINDING,
  TYPE_QUALYS_VULN,
  TYPE_QUALYS_WEB_APP,
  TYPE_QUALYS_WEB_APP_FINDING,
} from '../converters';
import QualysClient from '../provider/QualysClient';
import { QualysHttpRecorder } from '../provider/QualysHttpRecorder';
import { QualysIntegrationConfig } from '../types';
import { invokeSafely } from '../util/errorHandlerUtil';

const step: IntegrationStep<QualysIntegrationConfig> = {
  id: 'collect-data',
  name: 'Collect Data',

  entities: [
    {
      _type: TYPE_QUALYS_HOST,
      _class: 'Host',
      resourceName: 'Host',
    },
    {
      _type: TYPE_QUALYS_HOST_FINDING,
      _class: 'Finding',
      resourceName: 'Host Finding',
    },
    {
      _type: TYPE_QUALYS_WEB_APP,
      _class: 'Application',
      resourceName: 'Web App',
    },
    {
      _type: TYPE_QUALYS_WEB_APP_FINDING,
      _class: 'Finding',
      resourceName: 'Web App Finding',
    },
    {
      _type: TYPE_QUALYS_VULN,
      _class: 'Vulnerability',
      resourceName: 'Vulnerability',
    },
  ],

  relationships: [
    {
      _type: 'qualys_host_has_finding',
      _class: RelationshipClass.HAS,
      sourceType: TYPE_QUALYS_HOST,
      targetType: TYPE_QUALYS_HOST_FINDING,
    },
    {
      _type: 'qualys_host_finding_is_vuln',
      _class: RelationshipClass.IS,
      sourceType: TYPE_QUALYS_HOST_FINDING,
      targetType: TYPE_QUALYS_VULN,
    },
    {
      _type: 'qualys_web_app_has_finding',
      _class: RelationshipClass.HAS,
      sourceType: TYPE_QUALYS_WEB_APP,
      targetType: TYPE_QUALYS_WEB_APP_FINDING,
    },
    {
      _type: 'qualys_web_app_finding_is_vuln',
      _class: RelationshipClass.IS,
      sourceType: TYPE_QUALYS_HOST_FINDING,
      targetType: TYPE_QUALYS_VULN,
    },
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
