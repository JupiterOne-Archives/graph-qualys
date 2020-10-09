import {
  createDirectRelationship,
  createMappedRelationship,
  Entity,
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

export async function fetchScannedWebApps({
  logger,
  instance,
  jobState,
}: IntegrationStepExecutionContext<QualysIntegrationConfig>) {
  const apiClient = createQualysAPIClient(logger, instance.config);

  const serviceEntity = (await jobState.getData(
    DATA_WAS_SERVICE_ENTITY,
  )) as Entity;

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
            },
          },
        }),
      );
    },
    { filters: { isScanned: true } },
  );

  await jobState.setData(DATA_SCANNED_WEBAPP_IDS, scannedWebAppIds);

  // `filter` reflects parameters used to limit the set of web apps processed by the
  // integration. A value of `'all'` means no filters were used so that all
  // web apps are processed.
  logger.info(
    { numScannedWebAppIds: scannedWebAppIds.length, filter: 'isScanned' },
    'Scanned web app IDs collected',
  );
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

  await apiClient.iterateWebAppFindings(scannedWebAppIds, async (finding) => {
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

    if (finding.qid) {
      vulnerabilityFindingKeysCollector.addVulnerabilityFinding(
        finding.qid,
        findingEntity._key,
      );

      // Ensure that finding keys are updated for each finding
      // so that should a partial set be ingested, we don't lose what we've seen
      // for later steps.
      await jobState.setData(
        DATA_WEBAPP_VULNERABILITY_FINDING_KEYS,
        vulnerabilityFindingKeysCollector.toVulnerabilityFindingKeys(),
      );
    } else {
      logger.info(
        { finding: { id: finding.id, uniqueId: finding.uniqueId } },
        'Web app finding has no QID',
      );
    }
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
