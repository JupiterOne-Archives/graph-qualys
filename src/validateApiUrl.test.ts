import { IntegrationValidationError } from '@jupiterone/integration-sdk-core';

import { validateApiUrl } from './validateApiUrl';

describe('validateApiUrl', () => {
  test('not a url at all', () => {
    expect(() => validateApiUrl('wut')).toThrow(IntegrationValidationError);
  });

  test('invalid qualysguard subdomain', () => {
    const invalidApiUrl = 'https://qualysguard.qg3.apps.qualys.com';
    expect(() => validateApiUrl(invalidApiUrl)).toThrow(
      IntegrationValidationError,
    );
  });

  test('valid qualysapi subdoman', () => {
    expect(() =>
      validateApiUrl('https://qualysapi.qg3.apps.qualys.com'),
    ).not.toThrowError();
  });

  test('localhost for mock server', () => {
    expect(() => validateApiUrl('http://localhost:8080')).not.toThrowError();
  });
});
