import {
  Execution,
  IntegrationExecutionContext,
} from '@jupiterone/integration-sdk-core';
import { createMockExecutionContext } from '@jupiterone/integration-sdk-testing';

import { calculateConfig } from './calculateConfig';
import {
  DEFAULT_FINDINGS_SINCE_DAYS,
  DEFAULT_SCANNED_SINCE_DAYS,
} from './constants';
import { QualysIntegrationConfig } from './types';

const nowTime = 1602528224084;
const nowISODate = '2020-10-12T18:43:44Z';

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
  jest.spyOn(Date, 'now').mockImplementation(() => nowTime);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('maxScannedSinceISODate', () => {
  test('matches execution time', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minScannedSinceDays: 3,
      }),
      executionHistory: {
        current: {
          startedOn: nowTime,
        },
      },
    });
    const config = calculateConfig(context);
    expect(config.maxScannedSinceISODate).toEqual(nowISODate);
    expect(config.minScannedSinceISODate).toEqual('2020-10-09T18:43:44Z');
  });
});

describe('maxFindingsSinceISODate', () => {
  test('matches execution time', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: 3,
      }),
      executionHistory: {
        current: {
          startedOn: nowTime,
        },
      },
    });
    const config = calculateConfig(context);
    expect(config.maxFindingsSinceISODate).toEqual(nowISODate);
    expect(config.minFindingsSinceISODate).toEqual('2020-10-09T18:43:44Z');
  });
});

describe('minScannedSinceDays', () => {
  beforeEach(() => {
    delete process.env.MIN_SCANNED_SINCE_DAYS;
  });

  test('undefined on existing configs', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minScannedSinceDays: undefined as any,
      }),
    });
    const config = calculateConfig(context);
    expect(config.minScannedSinceDays).toEqual(DEFAULT_SCANNED_SINCE_DAYS);
    expect(config.minScannedSinceISODate).toEqual('2020-10-05T18:43:44Z');
  });

  test('empty string', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({ minScannedSinceDays: ' ' as any }),
    });
    const config = calculateConfig(context);
    expect(config.minScannedSinceDays).toEqual(DEFAULT_SCANNED_SINCE_DAYS);
    expect(config.minScannedSinceISODate).toEqual('2020-10-05T18:43:44Z');
  });

  test('non-numeric string', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minScannedSinceDays: ' abc' as any,
      }),
    });
    expect(() => {
      calculateConfig(context);
    }).toThrow(/minScannedSinceDays/);
  });

  test('numeric string', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minScannedSinceDays: '91' as any,
      }),
    });
    const config = calculateConfig(context);
    expect(config.minScannedSinceDays).toEqual(91);
    expect(config.minScannedSinceISODate).toEqual('2020-07-13T18:43:44Z');
  });

  test('numeric string with spaces', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minScannedSinceDays: ' 91 ' as any,
      }),
    });
    const config = calculateConfig(context);
    expect(config.minScannedSinceDays).toEqual(91);
    expect(config.minScannedSinceISODate).toEqual('2020-07-13T18:43:44Z');
  });

  test('numeric', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({ minScannedSinceDays: 91 }),
    });
    const config = calculateConfig(context);
    expect(config.minScannedSinceDays).toEqual(91);
    expect(config.minScannedSinceISODate).toEqual('2020-07-13T18:43:44Z');
  });

  test('numeric float allows less than one day', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({ minScannedSinceDays: 0.166 }),
    });
    const config = calculateConfig(context);
    expect(config.minScannedSinceDays).toEqual(0.166);
    expect(config.minScannedSinceISODate).toEqual('2020-10-12T14:44:41Z');
  });

  test('MIN_SCANNED_SINCE_DAYS environment variable', () => {
    process.env.MIN_SCANNED_SINCE_DAYS = '91';
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig(),
    });
    const config = calculateConfig(context);
    expect(config.minScannedSinceDays).toEqual(91);
    expect(config.minScannedSinceISODate).toEqual('2020-07-13T18:43:44Z');
  });

  test('last successful execution used when less than since days', () => {
    const current: Execution = {
      startedOn: nowTime,
    };
    const lastSuccessful: Execution = {
      startedOn: nowTime - 10000,
    };

    const context: IntegrationExecutionContext<QualysIntegrationConfig> = {
      ...createMockExecutionContext<QualysIntegrationConfig>({
        instanceConfig: createInstanceConfig({ minScannedSinceDays: 3 }),
      }),
      executionHistory: {
        current,
        previous: lastSuccessful,
        lastSuccessful,
      },
    };

    const config = calculateConfig(context);

    expect(config.minScannedSinceDays).toEqual(3);
    expect(config.minScannedSinceISODate).toEqual('2020-10-12T18:43:34Z');
  });

  test('last successful execution NOT used when greater than since days', () => {
    const current: Execution = {
      startedOn: nowTime,
    };
    const lastSuccessful: Execution = {
      startedOn: nowTime - 10 * (1000 * 60 * 60 * 24),
    };

    const context: IntegrationExecutionContext<QualysIntegrationConfig> = {
      ...createMockExecutionContext<QualysIntegrationConfig>({
        instanceConfig: createInstanceConfig({ minScannedSinceDays: 3 }),
      }),
      executionHistory: {
        current,
        previous: lastSuccessful,
        lastSuccessful,
      },
    };

    const config = calculateConfig(context);

    expect(config.minScannedSinceDays).toEqual(3);
    expect(config.minScannedSinceISODate).toEqual('2020-10-09T18:43:44Z');
  });
});

describe('minFindingsSinceDays', () => {
  beforeEach(() => {
    delete process.env.MIN_FINDINGS_SINCE_DAYS;
  });

  test('undefined on existing configs', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: undefined as any,
      }),
    });
    const config = calculateConfig(context);
    expect(config.minFindingsSinceDays).toEqual(DEFAULT_FINDINGS_SINCE_DAYS);
    expect(config.minFindingsSinceISODate).toEqual('2020-10-05T18:43:44Z');
  });

  test('empty string', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: ' ' as any,
      }),
    });
    const config = calculateConfig(context);
    expect(config.minFindingsSinceDays).toEqual(DEFAULT_FINDINGS_SINCE_DAYS);
    expect(config.minFindingsSinceISODate).toEqual('2020-10-05T18:43:44Z');
  });

  test('non-numeric string', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: ' abc' as any,
      }),
    });
    expect(() => {
      calculateConfig(context);
    }).toThrow(/minFindingsSinceDays/);
  });

  test('numeric string', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: '91' as any,
      }),
    });
    const config = calculateConfig(context);
    expect(config.minFindingsSinceDays).toEqual(91);
    expect(config.minFindingsSinceISODate).toEqual('2020-07-13T18:43:44Z');
  });

  test('numeric string with spaces', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({
        minFindingsSinceDays: ' 91 ' as any,
      }),
    });
    const config = calculateConfig(context);
    expect(config.minFindingsSinceDays).toEqual(91);
    expect(config.minFindingsSinceISODate).toEqual('2020-07-13T18:43:44Z');
  });

  test('numeric', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({ minFindingsSinceDays: 91 }),
    });
    const config = calculateConfig(context);
    expect(config.minFindingsSinceDays).toEqual(91);
    expect(config.minFindingsSinceISODate).toEqual('2020-07-13T18:43:44Z');
  });

  test('numeric float allows less than one day', () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig({ minFindingsSinceDays: 0.166 }),
    });
    const config = calculateConfig(context);
    expect(config.minFindingsSinceDays).toEqual(0.166);
    expect(config.minFindingsSinceISODate).toEqual('2020-10-12T14:44:41Z');
  });

  test('MIN_FINDINGS_SINCE_DAYS environment variable', () => {
    process.env.MIN_FINDINGS_SINCE_DAYS = '91';
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: createInstanceConfig(),
    });
    const config = calculateConfig(context);
    expect(config.minFindingsSinceDays).toEqual(91);
    expect(config.minFindingsSinceISODate).toEqual('2020-07-13T18:43:44Z');
  });

  test('last successful execution used when less than since days', () => {
    const current: Execution = {
      startedOn: nowTime,
    };
    const lastSuccessful: Execution = {
      startedOn: nowTime - 10000,
    };

    const context: IntegrationExecutionContext<QualysIntegrationConfig> = {
      ...createMockExecutionContext<QualysIntegrationConfig>({
        instanceConfig: createInstanceConfig({ minFindingsSinceDays: 3 }),
      }),
      executionHistory: {
        current,
        previous: lastSuccessful,
        lastSuccessful,
      },
    };

    const config = calculateConfig(context);

    expect(config.minFindingsSinceDays).toEqual(3);
    expect(config.minFindingsSinceISODate).toEqual('2020-10-12T18:43:34Z');
  });

  test('last successful execution NOT used when greater than since days', () => {
    const current: Execution = {
      startedOn: nowTime,
    };
    const lastSuccessful: Execution = {
      startedOn: nowTime - 10 * (1000 * 60 * 60 * 24),
    };

    const context: IntegrationExecutionContext<QualysIntegrationConfig> = {
      ...createMockExecutionContext<QualysIntegrationConfig>({
        instanceConfig: createInstanceConfig({ minFindingsSinceDays: 3 }),
      }),
      executionHistory: {
        current,
        previous: lastSuccessful,
        lastSuccessful,
      },
    };

    const config = calculateConfig(context);

    expect(config.minFindingsSinceDays).toEqual(3);
    expect(config.minFindingsSinceISODate).toEqual('2020-10-09T18:43:44Z');
  });
});
