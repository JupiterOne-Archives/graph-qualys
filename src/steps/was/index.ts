import { v4 as uuid } from 'uuid';
import {
  createDirectRelationship,
  createMappedRelationship,
  Entity,
  IntegrationInfoEventName,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core';

import { createQualysAPIClient } from '../../provider';
import { QualysIntegrationConfig } from '../../types';
import { DATA_WAS_SERVICE_ENTITY, STEP_FETCH_SERVICES } from '../services';
import { VulnerabilityFindingKeysCollector } from '../utils';
import {
  DATA_SCANNED_WEBAPP_IDS,
  DATA_WEBAPP_VULNERABILITY_FINDING_KEYS,
  MAPPED_RELATIONSHIP_TYPE_WAS_SCANS_WEBAPP,
  STEP_FETCH_SCANNED_WEBAPP_FINDINGS,
  STEP_FETCH_SCANNED_WEBAPPS,
  WasEntities,
  WasRelationships,
  MAPPED_RELATIONSHIP_TYPE_WEBAPP_HAS_FINDING,
  STEP_FETCH_ASSESSMENTS,
  MAPPED_RELATIONSHIP_TYPE_WEBAPP_HAS_ASSESSMENT,
  WasMappedRelationships,
} from './constants';
import {
  createWebAppFindingEntity,
  createWebScanAssessmentEntity,
} from './converters';
import { SearchScanReport, WasScan } from '../../provider/client/types/was';
import { sleep } from '../../util';

export async function fetchScannedWebApps({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);

  const serviceEntity = (await jobState.getData(
    DATA_WAS_SERVICE_ENTITY,
  )) as Entity;

  const filters = {
    isScanned: true,
    'lastScan.date': instance.config.minScannedSinceISODate,
  };

  const scannedWebAppIds: number[] = [];
  await apiClient.iterateWebApps(
    async (webApp) => {
      scannedWebAppIds.push(webApp.id!);

      await jobState.addRelationship(
        createMappedRelationship({
          _class: RelationshipClass.SCANS,
          _type: MAPPED_RELATIONSHIP_TYPE_WAS_SCANS_WEBAPP,
          _mapping: {
            sourceEntityKey: serviceEntity._key,
            relationshipDirection: RelationshipDirection.FORWARD,
            targetFilterKeys: [['_type', 'name']],
            targetEntity: {
              _class: 'Application',
              _type: 'web_app',
              name: webApp.name,
              displayName: webApp.name,
            },
          },
        }),
      );
    },
    { filters },
  );

  await jobState.setData(DATA_SCANNED_WEBAPP_IDS, scannedWebAppIds);

  logger.info(
    { numScannedWebAppIds: scannedWebAppIds.length, filters },
    'Scanned web app IDs collected',
  );

  logger.publishInfoEvent({
    name: IntegrationInfoEventName.Stats,
    description: `Found ${
      scannedWebAppIds.length
    } web applications with filters: ${JSON.stringify(filters)}`,
  });
}

export async function fetchScannedWebAppFindings({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);

  const scannedWebAppIds = (await jobState.getData(
    DATA_SCANNED_WEBAPP_IDS,
  )) as number[];
  const serviceEntity = (await jobState.getData(
    DATA_WAS_SERVICE_ENTITY,
  )) as Entity;

  const vulnerabilityFindingKeysCollector = new VulnerabilityFindingKeysCollector();

  let numWebAppFindingsProcessed = 0;
  let numPageErrors = 0;
  const errorCorrelationId = uuid();

  await apiClient.iterateWebAppFindings(
    scannedWebAppIds,
    async (finding) => {
      const findingEntity = await jobState.addEntity(
        createWebAppFindingEntity(finding),
      );

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.IDENTIFIED,
          from: serviceEntity,
          to: findingEntity,
        }),
      );

      await jobState.addRelationship(
        createMappedRelationship({
          _class: RelationshipClass.HAS,
          _type: MAPPED_RELATIONSHIP_TYPE_WEBAPP_HAS_FINDING,
          _mapping: {
            sourceEntityKey: findingEntity._key,
            relationshipDirection: RelationshipDirection.REVERSE,
            targetFilterKeys: [['_type', 'name']],
            targetEntity: {
              _class: 'Application',
              _type: 'web_app',
              name: finding.webApp?.name,
              displayName: finding.webApp?.name,
            },
          },
        }),
      );

      if (finding.qid) {
        vulnerabilityFindingKeysCollector.addVulnerabilityFindingKey(
          finding.qid,
          findingEntity._key,
        );
      } else {
        logger.info(
          { finding: { id: finding.id, uniqueId: finding.uniqueId } },
          'Web app finding has no QID',
        );
      }

      numWebAppFindingsProcessed++;
    },
    {
      filters: {
        lastDetectedDate: instance.config.minFindingsSinceISODate,
      },
      onRequestError(pageIds, err) {
        logger.error(
          { pageIds, err, errorCorrelationId },
          'Error ingesting page of web app findings',
        );
        numPageErrors++;
      },
    },
  );

  await jobState.setData(
    DATA_WEBAPP_VULNERABILITY_FINDING_KEYS,
    vulnerabilityFindingKeysCollector.serialize(),
  );

  logger.info(
    { numWebAppFindingsProcessed },
    'Processed web application findings',
  );

  logger.publishInfoEvent({
    name: IntegrationInfoEventName.Stats,
    description: `Processed ${numWebAppFindingsProcessed} web application findings${
      numPageErrors > 0
        ? `, encountered ${numPageErrors} errors (errorId="${errorCorrelationId}")`
        : ''
    }`,
  });
}

export async function fetchAssessments({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);

  const scannedWebAppIds = (await jobState.getData(
    DATA_SCANNED_WEBAPP_IDS,
  )) as number[];
  const NUM_RETRIES = 5;

  // Step 1 - get all the was scans
  const wasScans: WasScan[] = [];
  for (const webAppId of scannedWebAppIds) {
    await apiClient.iterateWebAppScans(
      (wasScan) => {
        wasScans.push(wasScan);
      },
      {
        filters: {
          'webApp.id': webAppId,
        },
      },
    );
  }

  // Step 2 - get all was scans IDs
  const scanIds: number[] = [];
  for (const wasScan of wasScans) {
    if (wasScan.id) {
      scanIds.push(wasScan.id);
    }
  }

  // Step 3 - create report for each scan
  const createdReportsIds: number[] = [];
  for (const scanId of scanIds) {
    const scanReportRequest = await apiClient.createScanReport(scanId);
    createdReportsIds.push(scanReportRequest.id);
  }

  for (const createdReportId of createdReportsIds) {
    // Step 4 - check if reports are completed
    let reportStatus = (await apiClient.searchReport(
      createdReportId,
    )) as SearchScanReport;
    let tries = 0;

    while (reportStatus.status !== 'COMPLETE' && tries < NUM_RETRIES) {
      tries++;
      reportStatus = (await apiClient.searchReport(
        createdReportId,
      )) as SearchScanReport;
      await sleep(3000);
    }

    if (reportStatus.status === 'COMPLETE') {
      // Step 5 - get reports
      const scanReport = await apiClient.fetchScanReport(createdReportId);
      const assessmentEntity = await jobState.addEntity(
        createWebScanAssessmentEntity(scanReport),
      );

      await jobState.addRelationship(
        createMappedRelationship({
          _class: RelationshipClass.HAS,
          _type: MAPPED_RELATIONSHIP_TYPE_WEBAPP_HAS_ASSESSMENT,
          _mapping: {
            sourceEntityKey: assessmentEntity._key,
            relationshipDirection: RelationshipDirection.REVERSE,
            targetFilterKeys: [['_type', 'name']],
            targetEntity: {
              _class: 'Application',
              _type: 'web_app',
              name: scanReport.APPENDIX.WEBAPP.NAME,
              displayName: scanReport.APPENDIX.WEBAPP.NAME,
            },
          },
        }),
      );
    }
  }
}

export const webApplicationSteps: IntegrationStep<QualysIntegrationConfig>[] = [
  {
    id: STEP_FETCH_SCANNED_WEBAPPS,
    name: 'Fetch Scanned Web Apps',
    entities: [],
    relationships: [],
    mappedRelationships: [WasMappedRelationships.SERVICE_SCANS_WEBAPP],
    dependsOn: [STEP_FETCH_SERVICES],
    executionHandler: fetchScannedWebApps,
  },
  {
    id: STEP_FETCH_SCANNED_WEBAPP_FINDINGS,
    name: 'Fetch Scanned Web App Findings',
    entities: [WasEntities.WEBAPP_FINDING],
    relationships: [
      WasRelationships.SERVICE_WEBAPP_FINDING,
      // TODO: Consider using createMappedRelationship since global mappings are
      // configured to `skipTargetCreation: true`.

      // targetFilterKeys: [
      //   ['_class', 'uri'],
      //   ['_class', 'url'],
      //   ['_class', 'webLink'],
      //   ['_class', 'name'],
      // ]

      // Global mappings will do the work of building a relationship between the
      // `Finding` and existing `Application` entities. It depends on the
      // `Finding.targets` containing a value that matches certain properties on
      // the `Application`.
    ],
    mappedRelationships: [WasMappedRelationships.WEBAPP_HAS_FINDING],
    dependsOn: [STEP_FETCH_SCANNED_WEBAPPS],
    executionHandler: fetchScannedWebAppFindings,
  },
  {
    id: STEP_FETCH_ASSESSMENTS,
    name: 'Fetch Assessments',
    entities: [WasEntities.WEBAPP_ASSESSMENT],
    relationships: [],
    mappedRelationships: [WasMappedRelationships.WEBAPP_HAS_ASSESSMENT],
    dependsOn: [STEP_FETCH_SERVICES, STEP_FETCH_SCANNED_WEBAPPS],
    executionHandler: fetchAssessments,
  },
];
