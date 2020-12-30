import { getQualysHost, toStringArray } from './';

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

describe('toStringArray', () => {
  test('removes duplicates', () => {
    expect(toStringArray(['a', 'a'])).toEqual(['a']);
  });

  test('drops undefined', () => {
    expect(toStringArray(['a', undefined])).toEqual(['a']);
  });

  test('drops null', () => {
    expect(toStringArray(['a', null as any])).toEqual(['a']);
  });

  test('converts numbers', () => {
    expect(toStringArray([1, 2.3])).toEqual(['1', '2.3']);
  });
});
