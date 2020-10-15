export type QualysIntegrationConfig = {
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
  minScannedSinceDays: number;

  /**
   * The date to use when searching for scanned web applications and hosts,
   * calculated from `minScannedSinceDays`.
   */
  minScannedSinceISODate: string;
};

export type PossibleArray<T> = T | T[];

export type Opaque<K, T> = T & { __TYPE__: K };

export type ISODateString = Opaque<'Date', string>;

export type QualyNumericSeverity = 1 | 2 | 3 | 4 | 5 | undefined;

/**
 * Values that conform to the `Finding.numericSeverity` property.
 */
export type NormalizedNumericSeverity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
