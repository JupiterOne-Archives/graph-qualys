/**
 * The integration config managed by the user. This will provide input into the
 * calculation of the `QualysIntegrationConfig` used throughout integration
 * execution.
 */
export type UserIntegrationConfig = {
  qualysUsername: string;
  qualysPassword: string;

  /**
   * The URL of the Qualys API.
   *
   * @example https://qualysapi.qg3.apps.qualys.com
   */
  qualysApiUrl: string;

  /**
   * The minimum number of days since execution time (now) to use when searching
   * for scanned web applications and hosts.
   */
  minScannedSinceDays: string | number;

  /**
   * The minimum number of days since execution time (now) to use when searching
   * for web app findings and host detections.
   */
  minFindingsSinceDays: string | number;

  /**
   * The severities to use when searching for host detections, used to limit
   * data fetched to only severities a security team wants to ingest.
   */
  vmdrFindingSeverities?: string | string[];

  /**
   * The types of host detections to convert to Findings, used to limit
   * collection to types a security team wants to ingest.
   */
  vmdrFindingTypes?: string | string[];

  ingestWebAppScans: boolean;
};

export type CalculatedIntegrationConfig = UserIntegrationConfig & {
  /**
   * The start date to use when searching for scanned web applications and
   * hosts, calculated from `minScannedSinceDays`.
   */
  minScannedSinceISODate: string;

  /**
   * The end date to use when searching for scanned hosts, calculated from
   * execution start time.
   */
  maxScannedSinceISODate: string;

  /**
   * The start date to use when searching for web application findings and host
   * detections, calculated from `minFindingsSinceDays`.
   */
  minFindingsSinceISODate: string;

  /**
   * The end date to use when searching for host detections, calculated from
   * execution start time.
   */
  maxFindingsSinceISODate: string;

  /**
   * The severities to use when searching for host detections, used to limit
   * data fetched to only severities a security team wants to ingest. Defaults
   * to `DEFAULT_VMDR_FINDING_SEVERITIES`.
   */
  vmdrFindingSeverityNumbers: number[];

  /**
   * The types of host detections to convert to Findings, used to limit
   * collection to types a security team wants to ingest. Defaults to
   * `DEFAULT_VMDR_FINDING_TYPES`.
   */
  vmdrFindingTypeValues: string[];
};

/**
 * The integration config expected throughout the integration execution,
 * including all calculated properties.
 */
export type QualysIntegrationConfig = CalculatedIntegrationConfig;

export type PossibleArray<T> = T | T[];

export type Opaque<K, T> = T & { __TYPE__: K };

export type ISODateString = Opaque<'Date', string>;

export type QualyNumericSeverity = 1 | 2 | 3 | 4 | 5 | undefined;

/**
 * Values that conform to the `Finding.numericSeverity` property.
 */
export type NormalizedNumericSeverity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
