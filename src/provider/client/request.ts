import Timeout from 'await-timeout';
import EventEmitter from 'events';
import { Response } from 'node-fetch';

import {
  ClientDelayedRequestEvent,
  ClientEvent,
  ClientEvents,
  ClientRequestEvent,
  ClientResponseEvent,
  RateLimitConfig,
  RateLimitState,
  RetryConfig,
} from './types';

export async function executeAPIRequest<T>(
  events: EventEmitter,
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
  exec: () => Promise<Response>;
  retryConfig: RetryConfig;
  rateLimitConfig: RateLimitConfig;
  rateLimitState: RateLimitState;
};

type APIRequestAttempt = APIRequest & {
  completed: boolean;
  retryable: boolean;
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

function emitRequestEvent(events: EventEmitter, event: ClientRequestEvent) {
  events.emit(ClientEvents.REQUEST, event);
}

function emitDelayedRequestEvent(
  events: EventEmitter,
  event: ClientDelayedRequestEvent,
) {
  events.emit(ClientEvents.DELAYED_REQUEST, event);
}

function emitResponseEvent(events: EventEmitter, event: ClientResponseEvent) {
  events.emit(ClientEvents.RESPONSE, event);
}

async function attemptAPIRequest(
  events: EventEmitter,
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
    url: request.url,
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
    emitDelayedRequestEvent(events, { ...requestEvent, delay });
    await Timeout.set(delay);
  }

  emitRequestEvent(events, requestEvent);

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

  const retryable = !retryConfig.noRetry.includes(response.status);
  const retryAttempts =
    !completed && !rateLimited
      ? request.retryAttempts + 1
      : request.retryAttempts;

  const totalAttempts = request.totalAttempts + 1;

  const apiResponse: APIResponse = {
    request: {
      ...request,
      completed,
      retryable,
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

  emitResponseEvent(events, {
    url: request.url,
    status: response.status,
    statusText: response.statusText,
    completed,
    retryable,
    retryConfig: request.retryConfig,
    retryAttempts,
    rateLimitConfig: request.rateLimitConfig,
    rateLimitState: responseRateLimitState,
    rateLimitedAttempts,
    totalAttempts,
  });

  return apiResponse;
}

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
  if (!limit && concurrency) {
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
