import {
  Execution,
  IntegrationExecutionContext,
} from '@jupiterone/integration-sdk-core';
import { createMockExecutionContext } from '@jupiterone/integration-sdk-testing';

import {
  DEFAULT_FINDINGS_SINCE_DAYS,
  DEFAULT_SCANNED_SINCE_DAYS,
} from './constants';
import createQualysAPIClient from './provider/createQualysAPIClient';
import { QualysIntegrationConfig } from './types';
import validateInvocation from './validateInvocation';

jest.mock('./provider/createQualysAPIClient');

function createInstanceConfig(
  overrides?: Partial<QualysIntegrationConfig>,
): QualysIntegrationConfig {
  return {
    qualysApiUrl: 'https://qualysapi.qualys.com',
    qualysUsername: 'username123',
    qualysPassword: 'passwordabc',
    ...overrides,
  } as QualysIntegrationConfig;
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => 1602528224084);
  (createQualysAPIClient as jest.Mock).mockReturnValue({
    verifyAuthentication: jest.fn(),
    validateApiUrl: jest.fn(),
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('minScannedSinceDays', () => {
  beforeEach(() => {
    delete process.env.MIN_SCANNED_SINCE_DAYS;
  });

  test('undefined on existing configs', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minScannedSinceDays: undefined as any,
      }),
    });
    await validateInvocation(context);
    expect(context.instance.config.minScannedSinceDays).toEqual(
      DEFAULT_SCANNED_SINCE_DAYS,
    );
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-10-05T18:43:44Z',
    );
  });

  test('empty string', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({ minScannedSinceDays: ' ' as any }),
    });
    await validateInvocation(context);
    expect(context.instance.config.minScannedSinceDays).toEqual(
      DEFAULT_SCANNED_SINCE_DAYS,
    );
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-10-05T18:43:44Z',
    );
  });

  test('non-numeric string', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minScannedSinceDays: ' abc' as any,
      }),
    });
    await expect(validateInvocation(context)).rejects.toThrow(
      /minScannedSinceDays/,
    );
  });

  test('numeric string', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minScannedSinceDays: '91' as any,
      }),
    });
    await validateInvocation(context);
    expect(context.instance.config.minScannedSinceDays).toEqual(91);
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });

  test('numeric string with spaces', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minScannedSinceDays: ' 91 ' as any,
      }),
    });
    await validateInvocation(context);
    expect(context.instance.config.minScannedSinceDays).toEqual(91);
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });

  test('numeric', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({ minScannedSinceDays: 91 }),
    });
    await validateInvocation(context);
    expect(context.instance.config.minScannedSinceDays).toEqual(91);
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });

  test('MIN_SCANNED_SINCE_DAYS environment variable', async () => {
    process.env.MIN_SCANNED_SINCE_DAYS = '91';
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig(),
    });
    await validateInvocation(context);
    expect(context.instance.config.minScannedSinceDays).toEqual(91);
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });

  test('last successful execution used when less than since days', async () => {
    const lastExecution: Execution = {
      startedOn: Date.now(),
    };

    const context: IntegrationExecutionContext<QualysIntegrationConfig> = {
      ...createMockExecutionContext<QualysIntegrationConfig>({
        instanceConfig: createInstanceConfig({ minScannedSinceDays: 3 }),
      }),
      history: {
        lastExecution,
        lastSuccessfulExecution: lastExecution,
      },
    };

    await validateInvocation(context);

    expect(context.instance.config.minScannedSinceDays).toEqual(3);
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-10-12T18:43:44Z',
    );
  });

  test('last successful execution NOT used when greater than since days', async () => {
    const lastExecution: Execution = {
      startedOn: Date.now() - 10 * (1000 * 60 * 60 * 24),
    };

    const context: IntegrationExecutionContext<QualysIntegrationConfig> = {
      ...createMockExecutionContext<QualysIntegrationConfig>({
        instanceConfig: createInstanceConfig({ minScannedSinceDays: 3 }),
      }),
      history: {
        lastExecution,
        lastSuccessfulExecution: lastExecution,
      },
    };

    await validateInvocation(context);

    expect(context.instance.config.minScannedSinceDays).toEqual(3);
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-10-09T18:43:44Z',
    );
  });
});

describe('minFindingsSinceDays', () => {
  beforeEach(() => {
    delete process.env.MIN_FINDINGS_SINCE_DAYS;
  });

  test('undefined on existing configs', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: undefined as any,
      }),
    });
    await validateInvocation(context);
    expect(context.instance.config.minFindingsSinceDays).toEqual(
      DEFAULT_FINDINGS_SINCE_DAYS,
    );
    expect(context.instance.config.minFindingsSinceISODate).toEqual(
      '2020-10-05T18:43:44Z',
    );
  });

  test('empty string', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: ' ' as any,
      }),
    });
    await validateInvocation(context);
    expect(context.instance.config.minFindingsSinceDays).toEqual(
      DEFAULT_FINDINGS_SINCE_DAYS,
    );
    expect(context.instance.config.minFindingsSinceISODate).toEqual(
      '2020-10-05T18:43:44Z',
    );
  });

  test('non-numeric string', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: ' abc' as any,
      }),
    });
    await expect(validateInvocation(context)).rejects.toThrow(
      /minFindingsSinceDays/,
    );
  });

  test('numeric string', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: '91' as any,
      }),
    });
    await validateInvocation(context);
    expect(context.instance.config.minFindingsSinceDays).toEqual(91);
    expect(context.instance.config.minFindingsSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });

  test('numeric string with spaces', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: ' 91 ' as any,
      }),
    });
    await validateInvocation(context);
    expect(context.instance.config.minFindingsSinceDays).toEqual(91);
    expect(context.instance.config.minFindingsSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });

  test('numeric', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({ minFindingsSinceDays: 91 }),
    });
    await validateInvocation(context);
    expect(context.instance.config.minFindingsSinceDays).toEqual(91);
    expect(context.instance.config.minFindingsSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });

  test('MIN_FINDINGS_SINCE_DAYS environment variable', async () => {
    process.env.MIN_FINDINGS_SINCE_DAYS = '91';
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig(),
    });
    await validateInvocation(context);
    expect(context.instance.config.minFindingsSinceDays).toEqual(91);
    expect(context.instance.config.minFindingsSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });

  test('last successful execution used when less than since days', async () => {
    const lastExecution: Execution = {
      startedOn: Date.now(),
    };

    const context: IntegrationExecutionContext<QualysIntegrationConfig> = {
      ...createMockExecutionContext<QualysIntegrationConfig>({
        instanceConfig: createInstanceConfig({ minFindingsSinceDays: 3 }),
      }),
      history: {
        lastExecution,
        lastSuccessfulExecution: lastExecution,
      },
    };

    await validateInvocation(context);

    expect(context.instance.config.minFindingsSinceDays).toEqual(3);
    expect(context.instance.config.minFindingsSinceISODate).toEqual(
      '2020-10-12T18:43:44Z',
    );
  });

  test('last successful execution NOT used when greater than since days', async () => {
    const lastExecution: Execution = {
      startedOn: Date.now() - 10 * (1000 * 60 * 60 * 24),
    };

    const context: IntegrationExecutionContext<QualysIntegrationConfig> = {
      ...createMockExecutionContext<QualysIntegrationConfig>({
        instanceConfig: createInstanceConfig({ minFindingsSinceDays: 3 }),
      }),
      history: {
        lastExecution,
        lastSuccessfulExecution: lastExecution,
      },
    };

    await validateInvocation(context);

    expect(context.instance.config.minFindingsSinceDays).toEqual(3);
    expect(context.instance.config.minFindingsSinceISODate).toEqual(
      '2020-10-09T18:43:44Z',
    );
  });
});
