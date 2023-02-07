import {
  createMockStepExecutionContext,
  Recording,
} from '@jupiterone/integration-sdk-testing';

import { config } from '../../../test/config';
import { setupQualysRecording } from '../../../test/recording';
import { calculateConfig } from '../../calculateConfig';
import { QualysIntegrationConfig } from '../../types';
import { fetchAccountDetails } from '../account';
import { fetchServices } from '../services';
import {
  fetchScannedHostDetails,
  fetchScannedHostFindings,
  fetchScannedHostIds,
} from '../vmdr';
import { fetchFindingVulnerabilities } from '../vulns';
import { fetchScannedWebAppFindings, fetchScannedWebApps } from '../was';

jest.setTimeout(1000 * 60 * 1);

let recording: Recording;

afterEach(async () => {
  await recording.stop();
});

test('steps', async () => {
  recording = setupQualysRecording({
    directory: __dirname,
    name: 'steps',
    options: {
      matchRequestsBy: {
        url: {
          query: false,
        },
      },
    },
  });

  const nowTimestamp = 1599865230000; // '2020-09-11T23:00:30Z';
  jest.spyOn(Date, 'now').mockImplementation(() => nowTimestamp);

  const context = createMockStepExecutionContext<QualysIntegrationConfig>({
    instanceConfig: config,
  });

  context.instance.config = calculateConfig(context);

  await fetchAccountDetails(context);
  await fetchServices(context);
  await fetchScannedWebApps(context);
  await fetchScannedWebAppFindings(context);
  await fetchScannedHostIds(context);
  await fetchScannedHostDetails(context);
  await fetchScannedHostFindings(context);
  await fetchFindingVulnerabilities(context);

  // Review snapshot, failure is a regression
  // expect({
  //   numCollectedEntities: context.jobState.collectedEntities.length,
  //   numCollectedRelationships: context.jobState.collectedRelationships.length,
  //   collectedEntities: context.jobState.collectedEntities,
  //   collectedRelationships: context.jobState.collectedRelationships,
  //   encounteredTypes: context.jobState.encounteredTypes,
  // }).toMatchSnapshot();

  expect(
    context.jobState.collectedEntities.filter((e) =>
      e._class.includes('Account'),
    ),
  ).toMatchGraphObjectSchema({
    _class: ['Account'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: { const: 'qualys_account' },
        name: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['name'],
    },
  });

  expect(
    context.jobState.collectedEntities.filter((e) =>
      e._class.includes('Service'),
    ),
  ).toMatchGraphObjectSchema({
    _class: ['Service'],
    schema: {
      additionalProperties: true,
      properties: {
        _type: {
          enum: ['qualys_web_app_scanner', 'qualys_vulnerability_manager'],
        },
        name: { type: 'string' },
        version: { type: 'string' },
        _rawData: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['name'],
    },
  });
});

test('fetchScannedHostDetails', async () => {
  recording = setupQualysRecording({
    directory: __dirname,
    name: 'fetchScannedHostDetails',
  });

  const nowTimestamp = 1599865230000; // '2020-09-11T23:00:30Z';
  jest.spyOn(Date, 'now').mockImplementation(() => nowTimestamp);

  const context = createMockStepExecutionContext<QualysIntegrationConfig>({
    instanceConfig: config,
  });

  await fetchAccountDetails(context);
  await fetchServices(context);
  await fetchScannedHostDetails(context);

  expect({
    numCollectedEntities: context.jobState.collectedEntities.length,
    numCollectedRelationships: context.jobState.collectedRelationships.length,
    collectedEntities: context.jobState.collectedEntities,
    collectedRelationships: context.jobState.collectedRelationships,
    encounteredTypes: context.jobState.encounteredTypes,
  }).toMatchSnapshot('fetchScannedHostDetails');
});

test('fetchScannedHostFindings', async () => {
  recording = setupQualysRecording({
    directory: __dirname,
    name: 'fetchScannedHostFindings',
  });

  const nowTimestamp = 1599865230000; // '2020-09-11T23:00:30Z';
  jest.spyOn(Date, 'now').mockImplementation(() => nowTimestamp);

  const context = createMockStepExecutionContext<QualysIntegrationConfig>({
    instanceConfig: config,
  });

  await fetchAccountDetails(context);
  await fetchServices(context);
  await fetchScannedHostFindings(context);

  expect({
    numCollectedEntities: context.jobState.collectedEntities.length,
    numCollectedRelationships: context.jobState.collectedRelationships.length,
    collectedEntities: context.jobState.collectedEntities,
    collectedRelationships: context.jobState.collectedRelationships,
    encounteredTypes: context.jobState.encounteredTypes,
  }).toMatchSnapshot('fetchScannedHostFindings');
});

test('fetchScannedWebApps', async () => {
  recording = setupQualysRecording({
    directory: __dirname,
    name: 'fetchScannedWebApps',
  });

  const nowTimestamp = 1652212328000; // '2020-05-10T07:52:08Z';
  jest.spyOn(Date, 'now').mockImplementation(() => nowTimestamp);

  const context = createMockStepExecutionContext<QualysIntegrationConfig>({
    instanceConfig: config,
  });

  context.instance.config = calculateConfig(context);

  await fetchAccountDetails(context);
  await fetchServices(context);
  await fetchScannedWebApps(context);

  expect({
    numCollectedEntities: context.jobState.collectedEntities.length,
    numCollectedRelationships: context.jobState.collectedRelationships.length,
    collectedEntities: context.jobState.collectedEntities,
    collectedRelationships: context.jobState.collectedRelationships,
    encounteredTypes: context.jobState.encounteredTypes,
  }).toMatchSnapshot('fetchScannedWebApps');
});

test('fetchScannedWebAppFindings', async () => {
  recording = setupQualysRecording({
    directory: __dirname,
    name: 'fetchScannedWebAppFindings',
  });

  const nowTimestamp = 1652212328000; // '2020-05-10T07:52:08Z';
  jest.spyOn(Date, 'now').mockImplementation(() => nowTimestamp);

  const context = createMockStepExecutionContext<QualysIntegrationConfig>({
    instanceConfig: config,
  });

  context.instance.config = calculateConfig(context);

  await fetchAccountDetails(context);
  await fetchServices(context);
  await fetchScannedWebApps(context);
  await fetchScannedWebAppFindings(context);

  expect({
    numCollectedEntities: context.jobState.collectedEntities.length,
    numCollectedRelationships: context.jobState.collectedRelationships.length,
    collectedEntities: context.jobState.collectedEntities,
    collectedRelationships: context.jobState.collectedRelationships,
    encounteredTypes: context.jobState.encounteredTypes,
  }).toMatchSnapshot('fetchScannedWebAppFindings');
});
