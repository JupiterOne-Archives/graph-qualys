import {
  createMockStepExecutionContext,
  Recording,
} from '@jupiterone/integration-sdk-testing';

import { config } from '../../../test/config';
import { setupQualysRecording } from '../../../test/recording';
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
  });

  const nowTimestamp = 1602457230303; // '2020-10-11T23:00:30.303Z';
  jest.spyOn(Date, 'now').mockImplementation(() => nowTimestamp);

  const context = createMockStepExecutionContext<QualysIntegrationConfig>({
    instanceConfig: config,
  });

  await fetchAccountDetails(context);
  await fetchServices(context);
  await fetchScannedWebApps(context);
  await fetchScannedWebAppFindings(context);
  await fetchScannedHostIds(context);
  await fetchScannedHostDetails(context);
  await fetchScannedHostFindings(context);
  await fetchFindingVulnerabilities(context);

  // Review snapshot, failure is a regression
  expect({
    numCollectedEntities: context.jobState.collectedEntities.length,
    numCollectedRelationships: context.jobState.collectedRelationships.length,
    collectedEntities: context.jobState.collectedEntities,
    collectedRelationships: context.jobState.collectedRelationships,
    encounteredTypes: context.jobState.encounteredTypes,
  }).toMatchSnapshot();

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
      required: ['name', 'version'],
    },
  });
});
