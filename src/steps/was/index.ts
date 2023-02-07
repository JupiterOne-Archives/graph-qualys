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
} from './constants';
import { createWebAppFindingEntity } from './converters';
import { Description } from './types';

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
      let desc: Description = {};
      if (finding.qid) {
        await apiClient.iterateVulnerabilities(
          [finding.qid],
          (details) => {
            const {
              DIAGNOSIS: description,
              CONSEQUENCE: impact,
              SOLUTION: recommendation,
              CVE_LIST: cveList,
            } = details;

            desc = {
              description,
              impact,
              recommendation,
              reference: Array.isArray(cveList?.CVE)
                ? cveList?.CVE?.map((cve) => cve.URL).join('\n')
                : cveList?.CVE?.URL,
            };
          },
          {
            onRequestError: (_pageIds, err) => {
              logger.error(err);
            },
          },
        );
      }

      const findingEntity = await jobState.addEntity(
        createWebAppFindingEntity({ finding, desc }),
      );

      await jobState.addRelationship(
        createDirectRelationship({
          _class: RelationshipClass.IDENTIFIED,
          from: serviceEntity,
          to: findingEntity,
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

export const webApplicationSteps: IntegrationStep<QualysIntegrationConfig>[] = [
  {
    id: STEP_FETCH_SCANNED_WEBAPPS,
    name: 'Fetch Scanned Web Apps',
    entities: [],
    relationships: [WasRelationships.SERVICE_SCANS_WEBAPP],
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
    dependsOn: [STEP_FETCH_SCANNED_WEBAPPS],
    executionHandler: fetchScannedWebAppFindings,
  },
];
