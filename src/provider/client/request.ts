import * as crypto from 'crypto';
import EventEmitter from 'events';
import { RequestInit, Response } from 'node-fetch';
import { v4 as uuid } from 'uuid';

import { sleep } from '../../util';
import {
  CanRetryDecision,
  ClientDelayedRequestEvent,
  ClientEvent,
  ClientEvents,
  ClientRequestEvent,
  ClientResponseEvent,
  RateLimitConfig,
  RateLimitState,
  RetryConfig,
} from './types';

/**
 * @param events `ClientEventEmitter` to which request lifecycle `ClientEvents` will
 * be published, allowing a client to reuse the emitter across a number of
 * requests.
 * @param request `APIRequest` defining everything necessary to execute a
 * request
 */
export async function executeAPIRequest<T>(
  events: ClientEventEmitter,
  request: APIRequest,
): Promise<APIResponse> {
  const { retryConfig, rateLimitConfig } = request;

  let attemptExecution = true;

  let requestAttempt: APIRequestAttempt = {
    ...request,
    completed: false,
    retryable: true,
    totalAttempts: 0,
    retryAttempts: 0,
    rateLimitedAttempts: 0,
  };

  while (attemptExecution) {
    let apiResponse: APIResponse | undefined;

    try {
      apiResponse = await attemptAPIRequest(events, requestAttempt);
      requestAttempt = apiResponse.request;
    } catch (err) {
      if (err.type === 'request-timeout') {
        requestAttempt.retryAttempts += 1;
        requestAttempt.totalAttempts += 1;
        requestAttempt.retryable = true;

        if (requestAttempt.retryAttempts >= retryConfig.maxAttempts) {
          // If there are no more attempts left for timeout then just add
          // better err message and throw
          err.statusText = `TIMEOUT: Could not complete request within ${requestAttempt.totalAttempts} attempts!`;
          throw err;
        }
      } else {
        throw err;
      }
    }

    attemptExecution =
      !requestAttempt.completed &&
      requestAttempt.rateLimitedAttempts < rateLimitConfig.maxAttempts &&
      requestAttempt.retryAttempts < retryConfig.maxAttempts &&
      requestAttempt.retryable;

    if (!attemptExecution && apiResponse) {
      return apiResponse;
    }
  }

  throw new Error(
    `Could not complete request within ${requestAttempt.totalAttempts} attempts!`,
  );
}

type APIRequest = {
  url: string;
  hash: string;
  exec: () => Promise<Response>;
  retryConfig: RetryConfig;
  rateLimitConfig: RateLimitConfig;
  rateLimitState: RateLimitState;
};

type APIRequestAttempt = APIRequest & {
  completed: boolean;
  retryable: boolean;
  retryDecision?: CanRetryDecision;
  totalAttempts: number;
  retryAttempts: number;
  rateLimitedAttempts: number;
};

type APIResponse = {
  request: APIRequestAttempt;
  response: Response;
  completed: boolean;
  status: Response['status'];
  statusText: Response['statusText'];
  rateLimitState: RateLimitState;
};

type ListenerEvent =
  | ClientResponseEvent
  | ClientDelayedRequestEvent
  | ClientRequestEvent;
type PickListenerEvent<L, E> = L extends { type: E } ? L : never;

type RegisteredClientEventListener = {
  event: ClientEvents;
  listener: (...args: any) => void;
};

/**
 * An event emitter designed for specific events in the lifecycle of executing a
 * request.
 */
export class ClientEventEmitter {
  private events: EventEmitter;

  constructor() {
    this.events = new EventEmitter();
  }

  public on<E extends ClientEvents>(
    event: E,
    listener: (event: PickListenerEvent<ListenerEvent, E>) => void,
    options?: { path?: string },
  ): RegisteredClientEventListener {
    if (options?.path) {
      const path = options.path;
      const registeredListener = (
        event: PickListenerEvent<ListenerEvent, E>,
      ) => {
        if (event.url.includes(path)) {
          listener(event);
        }
      };
      this.events.on(event, registeredListener);
      return {
        event,
        listener: registeredListener,
      };
    } else {
      this.events.on(event, listener);
      return { event, listener };
    }
  }

  public removeListener(listener: RegisteredClientEventListener): void {
    this.events.removeListener(listener.event, listener.listener);
  }

  public emit<E extends ClientEvent>(event: E) {
    this.events.emit(event.type, event);
  }
}

async function attemptAPIRequest(
  events: ClientEventEmitter,
  request: APIRequestAttempt,
): Promise<APIResponse> {
  const { retryConfig, rateLimitConfig, rateLimitState } = request;

  const tryAfterCooldown =
    rateLimitState.limitRemaining <= rateLimitConfig.reserveLimit
      ? Date.now() + rateLimitConfig.cooldownPeriod
      : 0;

  const toWaitSec = rateLimitState.toWaitSeconds;
  const tryAfter = Math.max(Date.now() + toWaitSec * 1000, tryAfterCooldown);

  const requestEvent: ClientEvent = {
    type: ClientEvents.REQUEST,
    url: request.url,
    hash: request.hash,
    retryConfig: request.retryConfig,
    retryable: request.retryable,
    retryAttempts: request.retryAttempts,
    rateLimitConfig: request.rateLimitConfig,
    rateLimitState: request.rateLimitState,
    rateLimitedAttempts: request.rateLimitedAttempts,
    totalAttempts: request.totalAttempts,
  };

  const now = Date.now();
  if (tryAfter > now) {
    const delay = tryAfter - now;
    events.emit({
      ...requestEvent,
      type: ClientEvents.DELAYED_REQUEST,
      delay,
    });
    await sleep(delay);
  }

  events.emit(requestEvent);

  const response = await request.exec();

  const responseRateLimitState = extractRateLimitHeaders(
    response,
    rateLimitConfig,
    rateLimitState,
  );

  const completed = response.status >= 200 && response.status < 400;
  const rateLimited = response.status === rateLimitConfig.responseCode;
  const rateLimitedAttempts = rateLimited
    ? request.rateLimitedAttempts + 1
    : request.rateLimitedAttempts;

  const retryStatusCodePermitted = !retryConfig.noRetryStatusCodes.includes(
    response.status,
  );

  let retryDecision: CanRetryDecision = {
    retryable: retryStatusCodePermitted,
    reason: `Response status code is${
      retryStatusCodePermitted ? '' : ' not'
    } retryable`,
  };

  if (retryDecision.retryable && retryConfig.canRetry) {
    const canRetryDecision = await retryConfig.canRetry(response);
    if (canRetryDecision) {
      retryDecision = canRetryDecision;
    }
  }

  const retryAttempts =
    !completed && !rateLimited
      ? request.retryAttempts + 1
      : request.retryAttempts;

  const totalAttempts = request.totalAttempts + 1;

  const apiResponse: APIResponse = {
    request: {
      ...request,
      completed,
      retryable: retryDecision.retryable,
      retryDecision,
      rateLimitState: responseRateLimitState,
      totalAttempts,
      retryAttempts,
      rateLimitedAttempts,
    },
    response,
    rateLimitState: responseRateLimitState,
    completed,
    status: response.status,
    statusText: response.statusText,
  };

  events.emit({
    type: ClientEvents.RESPONSE,
    url: request.url,
    hash: request.hash,
    status: response.status,
    statusText: response.statusText,
    completed,
    retryable: retryDecision.retryable,
    retryConfig: request.retryConfig,
    retryAttempts,
    rateLimitConfig: request.rateLimitConfig,
    rateLimitState: responseRateLimitState,
    rateLimitedAttempts,
    totalAttempts,
  });

  return apiResponse;
}

export function hashAPIRequest(init: RequestInit) {
  let fingerprint: string | undefined;

  if (typeof init.body?.toString === 'function') {
    fingerprint = init.body.toString();
  } else if (typeof init.body === 'string') {
    fingerprint = init.body;
  } else if (init.body) {
    fingerprint = JSON.stringify(init.body);
  }

  if (!fingerprint || fingerprint === '{}') {
    fingerprint = uuid();
  }

  const shasum = crypto.createHash('sha1');
  shasum.update(fingerprint);
  return shasum.digest('hex');
}

export type UsernamePassword = {
  username: string;
  password: string;
};

export function basicAuthentication({
  username,
  password,
}: UsernamePassword): string {
  const authBuffer = Buffer.from(`${username}:${password}`, 'ascii');
  return `Basic ${authBuffer.toString('base64')}`;
}

export function buildAuthenticatedRequestInit(
  init: RequestInit,
  basicAuth: string,
): RequestInit {
  return {
    timeout: 0,
    ...init,
    headers: {
      ...init.headers,
      'x-requested-with': '@jupiterone/graph-qualys',
      authorization: basicAuth,
    },
    size: 0,
  };
}

/**
 * Extracts rate limit headers.
 *
 * Qualys documentation is confusing on this matter. For instance:
 * - Some docs say `X-ConcurrencyLimit-Limit`, and some say `X-Concurrency-Limit-Limit`
 * - There does not seem to be any headers like this on some endpoints
 *
 * @see https://www.qualys.com/docs/qualys-api-vmpc-user-guide.pdf
 * @see https://www.qualys.com/docs/qualys-api-limits.pdf
 */
function extractRateLimitHeaders(
  response: Response,
  rateLimitConfig: RateLimitConfig,
  defaultState: RateLimitState,
): RateLimitState {
  const limit = response.headers.get('x-ratelimit-limit');
  const concurrency = response.headers.get('x-concurrency-limit-limit');

  let toWaitSeconds = limit
    ? Number(response.headers.get('x-ratelimit-towait-sec'))
    : defaultState.toWaitSeconds;

  // Qualys docs indicate that when there is no `x-ratelimit-limit`, and there
  // is a `x-concurrency-limit-limit`, then we've hit the concurrency limit and
  // need to wait.
  if ((!limit || limit === '0') && concurrency) {
    toWaitSeconds = rateLimitConfig.concurrencyDelay / 1000;
  }

  return {
    limit: limit ? Number(limit) : defaultState.limit,
    limitWindowSeconds:
      Number(response.headers.get('x-ratelimit-window-sec')) ||
      defaultState.limitWindowSeconds,
    limitRemaining: limit
      ? Number(response.headers.get('x-ratelimit-remaining'))
      : defaultState.limitRemaining,
    toWaitSeconds: toWaitSeconds,
    concurrency: concurrency ? Number(concurrency) : defaultState.concurrency,
    concurrencyRunning: concurrency
      ? Number(response.headers.get('x-concurrency-limit-running'))
      : defaultState.concurrencyRunning,
  };
}
