/**
 * Detection target values (`Finding.targets`) pulled from a host asset that
 * serve as additional information for building Finding entities during host
 * detection processing.
 *
 * Some values available on a Qualys `HostAsset` are not available on the
 * `DetectionHost`. The `HostAsset` values are collected in one step and made
 * available to a later step because the Host entities are not added to the
 * `jobState` except as mapped relationship `targetEntity` properties, and are
 * therefore not available for lookup later.
 */
export type HostAssetTargets = {
  fqdn?: string;
  ec2InstanceArn?: string;
  awsAccountId?: string;
  gcpInstanceSelfLink?: string;
  gcpProjectId?: string;
};

/**
 * Maps a QWeb Host ID to `HostAssetTargets`.
 */
export type HostAssetTargetsMap = Record<number, HostAssetTargets>;
