export type QualysIntegrationConfig = {
  qualysUsername: string;
  qualysPassword: string;

  /**
   * The URL of the Qualys API.
   *
   * @example https://qualysapi.qg3.apps.qualys.com
   */
  qualysApiUrl: string;
};

export type PossibleArray<T> = T | T[];

export type Opaque<K, T> = T & { __TYPE__: K };

export type ISODateString = Opaque<'Date', string>;
