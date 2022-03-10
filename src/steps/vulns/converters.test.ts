import { CveList } from '../../provider/client/types/vmpc';
import { cveListToCveIds } from './converters';

describe('vulns converter', () => {
  describe('cveListToCveIds', () => {
    test('null and undefined input creates empty list', () => {
      const nullCveList = null;
      const undefinedCveList = undefined;
      expect(cveListToCveIds(nullCveList)).toStrictEqual([]);
      expect(cveListToCveIds(undefinedCveList)).toStrictEqual([]);
    });

    test('array of CVE input creates array of ids', () => {
      const cveList: CveList = {
        CVE: [
          {
            ID: 'test-id-1',
            URL: 'https://example.com/id/1',
          },
          {
            ID: 'test-id-2',
            URL: 'https://exmaple.com/id/2',
          },
          {
            ID: 'test-id-3',
            URL: 'https://example.com/id/3',
          },
        ],
      };

      const expected = ['test-id-1', 'test-id-2', 'test-id-3'];

      expect(cveListToCveIds(cveList)).toStrictEqual(expected);
    });

    test('single CVE object input creates array with one id', () => {
      const cveList: CveList = {
        CVE: {
          ID: 'test-id-1',
          URL: 'https://example.com/id/1',
        },
      };

      const expected = ['test-id-1'];

      expect(cveListToCveIds(cveList)).toStrictEqual(expected);
    });

    test('single CVE object with undefined properties creates empty array', () => {
      const cveList: CveList = {
        CVE: {},
      };

      const expected = [];
      expect(cveListToCveIds(cveList)).toStrictEqual(expected);
    });

    test('array of CVEs with undefined properties excludes undefined and creates array of ids', () => {
      const cveList: CveList = {
        CVE: [
          {
            ID: 'test-id-1',
            URL: 'https://example.come/id/1',
          },
          {},
        ],
      };

      const expected = ['test-id-1'];

      expect(cveListToCveIds(cveList)).toStrictEqual(expected);
    });
  });
});
