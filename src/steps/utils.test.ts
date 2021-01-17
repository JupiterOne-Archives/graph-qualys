import { VulnerabilityFindingKeysCollector } from './utils';

describe(VulnerabilityFindingKeysCollector, () => {
  test('serialize', () => {
    const collector = new VulnerabilityFindingKeysCollector();
    collector.addVulnerabilityFindingKey(1, 'f1');
    collector.addVulnerabilityFindingKey(1, 'f2');
    collector.addVulnerabilityFindingKey(2, 'f3');

    expect(collector.serialize()).toEqual([
      [1, new Set(['f1', 'f2'])],
      [2, new Set(['f3'])],
    ]);
  });

  test('loadSerialized', () => {
    const collector = new VulnerabilityFindingKeysCollector();
    collector.loadSerialized([
      [1, new Set(['f1', 'f2'])],
      [2, new Set(['f3'])],
    ]);
    collector.loadSerialized([
      [1, new Set(['f1a'])],
      [2, new Set(['f3a', 'f4'])],
      [3, new Set(['f5'])],
    ]);
    expect(collector.serialize()).toEqual([
      [1, new Set(['f1', 'f2', 'f1a'])],
      [2, new Set(['f3', 'f3a', 'f4'])],
      [3, new Set(['f5'])],
    ]);
  });
});
