export enum ClientEvents {
  REQUEST = 'ClientEvents.REQUEST',
  RESPONSE = 'ClientEvents.RESPONSE',
  DELAYED_REQUEST = 'ClientEvents.DELAYED_REQUEST',
}

export type ClientEvent = {
  url: string;
  hash: string;
  retryConfig: RetryConfig;
  retryable: boolean;
  retryAttempts: number;
  rateLimitConfig: RateLimitConfig;
  rateLimitState: RateLimitState;
  rateLimitedAttempts: number;
  totalAttempts: number;
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
  completed: boolean;
};

export type RetryConfig = {
  /**
   * The maximum number of times to retry an unexpected failed request.
   */
  maxAttempts: number;

  /**
   * Response codes that should not be retried.
   */
  noRetry: number[];
};

export type RateLimitConfig = {
  /**
   * The code of a rate limited response.
   */
  responseCode: 409;

  /**
   * The period of time in milliseconds to wait between requests when
   * concurrency limits have been reached.
   *
   * The API docs claim that there will be no headers providing a time to wait
   * before retry when the reponse is blocked because of concurrency
   * limitations.
   */
  concurrencyDelay: number;

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
   * Maximum number of times to retry a request that continues to receive rate
   * limited responses.
   *
   * The client will respect `x-ratelimit-towait-sec`, but should it end up in a
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
   * Number of API calls that are running after this request completed.
   */
  concurrencyRunning: number;
};
