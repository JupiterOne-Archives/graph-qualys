import { createMockExecutionContext } from '@jupiterone/integration-sdk-testing';

import { DEFAULT_SCANNED_SINCE_DAYS } from './constants';
import createQualysAPIClient from './provider/createQualysAPIClient';
import { QualysIntegrationConfig } from './types';
import validateInvocation from './validateInvocation';

jest.mock('./provider/createQualysAPIClient');

describe('minScannedSinceDays', () => {
  const config = {
    qualysApiUrl: 'https://qualysapi.qualys.com',
    qualysUsername: 'username123',
    qualysPassword: 'passwordabc',
  } as QualysIntegrationConfig;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 1602528224084);
    (createQualysAPIClient as jest.Mock).mockReturnValue({
      verifyAuthentication: jest.fn(),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('undefined on existing configs', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: { ...config, minScannedSinceDays: undefined as any },
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
      instanceConfig: { ...config, minScannedSinceDays: ' ' as any },
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
      instanceConfig: { ...config, minScannedSinceDays: ' abc' as any },
    });
    await expect(validateInvocation(context)).rejects.toThrow(
      /minScannedSinceDays/,
    );
  });

  test('numeric string', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: { ...config, minScannedSinceDays: '91' as any },
    });
    await validateInvocation(context);
    expect(context.instance.config.minScannedSinceDays).toEqual(91);
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });

  test('numeric string with spaces', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: { ...config, minScannedSinceDays: ' 91 ' as any },
    });
    await validateInvocation(context);
    expect(context.instance.config.minScannedSinceDays).toEqual(91);
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });

  test('numeric', async () => {
    const context = createMockExecutionContext<QualysIntegrationConfig>({
      instanceConfig: { ...config, minScannedSinceDays: 91 },
    });
    await validateInvocation(context);
    expect(context.instance.config.minScannedSinceDays).toEqual(91);
    expect(context.instance.config.minScannedSinceISODate).toEqual(
      '2020-07-13T18:43:44Z',
    );
  });
});
