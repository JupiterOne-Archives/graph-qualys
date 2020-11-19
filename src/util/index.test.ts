import { getQualysHost } from './';

describe('getQualysHost', () => {
  test('good', () => {
    expect(getQualysHost('https://qualysapi.qg3.apps.qualys.com')).toEqual(
      'qg3.apps.qualys.com',
    );
  });

  test('unexpected', () => {
    expect(() => getQualysHost('https://bobby.qg3.apps.qualys.com')).toThrow(
      /Unexpected Qualys API URL format/,
    );
  });
});
