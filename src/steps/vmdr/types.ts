/**
 * Maps a QWeb Host ID to a set of values it may be known by in
 * `Finding.targets`.
 *
 * Some values available on a Qualys `HostAsset` are not available on the
 * `DetectionHost`. The `HostAsset` values are collected in one step and made
 * available to a later step because the Host entities are only are not added to
 * the `jobState` except as mapped relationship `targetEntity` properties, and
 * are therefore not available for lookup later.
 */
export type HostAssetTargetsMap = Record<number, string[]>;

/**
 * Maps a Qualys vulnerability QID to the set of related `Finding._key` values.
 *
 * As Findings are created during the processing of `HostDetection` data, the
 * QID and `Finding._key` values are easily obtained, and therefore tracked for
 * a later step that will fetch vulnerabilities and create mapped relationships
 * between the Finding and Vulnerabilty.
 */
export type VulnerabilityFindingKeys = [number, Set<string>][];
