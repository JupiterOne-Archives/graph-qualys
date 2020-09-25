export * from './vmpc';
export * from './was';
export * from './util';

export enum ClientEvents {
  REQUEST = 'ClientEvents.REQUEST',
  RESPONSE = 'ClientEvents.RESPONSE',
  DELAYED_REQUEST = 'ClientEvents.DELAYED_REQUEST',
}

export type ClientEvent = {
  url: string;
  rateLimitConfig: RateLimitConfig;
  rateLimitState: RateLimitState;
  attempt: number;
};

export type ClientRequestEvent = ClientEvent;

export type ClientDelayedRequestEvent = ClientRequestEvent & {
  /**
   * Number of milliseconds until request will be delivered.
   */
  delay: number;
};

export type ClientResponseEvent = ClientEvent & {
  status: number | string | undefined;
  statusText: string | undefined;
};

export type RateLimitConfig = {
  /**
   * The code of a rate limited response.
   */
  responseCode: 429 | 409;

  /**
   * The limit remaining value at which the client should slow down. This
   * prevents the client from consuming all available requests, an important
   * consideration of other programs that need some request capacity.
   */
  reserveLimit: number;

  /**
   * A recommended period of time in milliseconds to wait between requests when
   * the `reserveLimit` is reached.
   *
   * This can be a value representing the refill rate of a "leaky bucket" or
   * just a guess about how soon another request can be made. Ideally there will
   * be enough information in the response headers to calculate a better value.
   */
  cooldownPeriod: number;

  /**
   * Maximum number of times to retry a request that continues to receive 429
   * responses.
   *
   * The client will respect `x-ratelimit-retryafter`, but should it end up in a
   * battle to get the next allowed request, it will give up after this many
   * tries.
   */
  maxAttempts: number;
};

/**
 * The last seen values from rate limit response headers.
 */
export type RateLimitState = {
  /**
   * Maximum number of API calls allowed in any given time period of `limitWindowSeconds`.
   */
  limit: number;

  /**
   * Number of API calls you can make right now before reaching the rate limit
   * in the current `limitWindowSeconds`.
   */
  limitRemaining: number;

  /**
   * Time period during which up to `limit` API calls are allowed.
   */
  limitWindowSeconds: number;

  /**
   * The wait period before you can make the next API call without being blocked
   * by the rate limiting rule.
   */
  toWaitSeconds: number;

  /**
   * Number of API calls you are allowed to run simultaneously.
   */
  concurrency: number;

  /**
   * Number of API calls that are running right now (including the one
   * identified in the current HTTP response header).
   */
  concurrencyRunning: number;
};
