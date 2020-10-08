import { IntegrationError } from '@jupiterone/integration-sdk-core';

/**
 * Maps a Qualys vulnerability QID to the set of related `Finding._key` values.
 *
 * As Findings are created during the processing of `HostDetection` data, the
 * QID and `Finding._key` values are easily obtained, and therefore tracked for
 * a later step that will fetch vulnerabilities and create mapped relationships
 * between the Finding and Vulnerabilty.
 */
export type SerializedVulnerabilityFindingKeys = [number, Set<string>][];

export type VulnerabilityFindingKeysMap = Map<number, Set<string>>;

export class VulnerabilityFindingKeysCollector {
  private mapping: VulnerabilityFindingKeysMap;

  constructor() {
    this.mapping = new Map();
  }

  /**
   * Adds a Finding._key to set of vulnerability findings.
   *
   * @param qid vulnerability QID
   * @param findingKey Finding._key related to vulnerability
   */
  public addVulnerabilityFinding(qid: number, findingKey: string): void {
    if (!qid)
      throw new IntegrationError({
        code: 'UNDEFINED_VULNERABILITY_QID',
        message: 'undefined QID provided for vulnerability',
      });

    let keys = this.mapping[qid];
    if (!keys) {
      keys = new Set();
      this.mapping.set(qid, keys);
    }
    keys.add(findingKey);
  }

  /**
   * Serializes collected values into form that can be stored between steps and
   * used to re-create the Map.
   */
  public toVulnerabilityFindingKeys(): SerializedVulnerabilityFindingKeys {
    return Array.from(this.mapping.entries());
  }
}
