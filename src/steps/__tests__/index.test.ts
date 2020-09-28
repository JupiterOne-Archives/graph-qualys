import {
  createMockStepExecutionContext,
  Recording,
} from '@jupiterone/integration-sdk-testing';

import { config } from '../../../test/config';
import { setupQualysRecording } from '../../../test/recording';
import { QualysIntegrationConfig } from '../../types';
import { fetchAccountDetails } from '../account';
import { fetchServices } from '../services';
import { fetchHostDetections, fetchHostIds } from '../vmdr';
import { fetchWebApps } from '../was';

jest.setTimeout(10000 * 2);

let recording: Recording;

afterEach(async () => {
  await recording.stop();
});

test('steps', async () => {
  recording = setupQualysRecording({
    directory: __dirname,
    name: 'steps',
  });

  const context = createMockStepExecutionContext<QualysIntegrationConfig>({
    instanceConfig: config,
  });

  await fetchAccountDetails(context);
  await fetchServices(context);
  await fetchWebApps(context);
  await fetchHostIds(context);
  await fetchHostDetections(context);

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
        _type: { const: 'qualys_service' },
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
