import Timeout from 'await-timeout';
import EventEmitter from 'events';
import { Response } from 'node-fetch';

import {
  ClientDelayedRequestEvent,
  ClientEvents,
  ClientRequestEvent,
  ClientResponseEvent,
  RateLimitConfig,
  RateLimitState,
} from './types';

type APIRequest = {
  url: string;
  exec: () => Promise<Response>;
  rateLimitConfig: RateLimitConfig;
  rateLimitState: RateLimitState;
};

type APIResponse = {
  response: Response;
  status: Response['status'];
  statusText: Response['statusText'];
  rateLimitState: RateLimitState;
};

export function emitRequestEvent(
  events: EventEmitter,
  event: ClientRequestEvent,
) {
  events.emit(ClientEvents.REQUEST, event);
}

export function emitDelayedRequestEvent(
  events: EventEmitter,
  event: ClientDelayedRequestEvent,
) {
  events.emit(ClientEvents.DELAYED_REQUEST, event);
}

export function emitResponseEvent(
  events: EventEmitter,
  event: ClientResponseEvent,
) {
  events.emit(ClientEvents.RESPONSE, event);
}

export async function executeAPIRequest<T>(
  events: EventEmitter,
  request: APIRequest,
): Promise<APIResponse> {
  const config = request.rateLimitConfig;

  let attempt = 1;
  let rateLimitState = request.rateLimitState;

  do {
    const tryAfterCooldown =
      rateLimitState.limitRemaining <= config.reserveLimit
        ? Date.now() + config.cooldownPeriod
        : 0;

    const toWaitSec = rateLimitState.toWaitSeconds;
    const tryAfter = Math.max(Date.now() + toWaitSec * 1000, tryAfterCooldown);

    const response = await tryAPIRequest(events, request, attempt, tryAfter);

    // TODO: pull this out to reflect that these are not supported by the Web
    // Application Scanning APIs
    rateLimitState = {
      limit: Number(response.headers.get('x-ratelimit-limit')),
      limitWindowSeconds: Number(
        response.headers.get('x-ratelimit-window-sec'),
      ),
      limitRemaining: Number(response.headers.get('x-ratelimit-remaining')),
      toWaitSeconds: Number(response.headers.get('x-ratelimit-towait-sec')),
      concurrency: Number(response.headers.get('x-concurrencylimit-limit')),
      concurrencyRunning: Number(
        response.headers.get('x-concurrencylimit-running'),
      ),
    };

    emitResponseEvent(events, {
      url: request.url,
      rateLimitConfig: request.rateLimitConfig,
      rateLimitState: request.rateLimitState,
      attempt,
      status: response.status,
      statusText: response.statusText,
    });

    if (response.status !== request.rateLimitConfig.responseCode) {
      return {
        response,
        rateLimitState,
        status: response.status,
        statusText: response.statusText,
      };
    }

    attempt += 1;
  } while (attempt <= request.rateLimitConfig.maxAttempts);

  throw new Error(`Could not complete request within ${attempt} attempts!`);
}

export async function tryAPIRequest(
  events: EventEmitter,
  request: APIRequest,
  attempt: number,
  tryAfter: number,
): Promise<Response> {
  const now = Date.now();
  if (tryAfter > now) {
    const delay = tryAfter - now;
    emitDelayedRequestEvent(events, {
      url: request.url,
      rateLimitConfig: request.rateLimitConfig,
      rateLimitState: request.rateLimitState,
      attempt,
      delay,
    });
    await Timeout.set(delay);
  }

  emitRequestEvent(events, {
    url: request.url,
    rateLimitConfig: request.rateLimitConfig,
    rateLimitState: request.rateLimitState,
    attempt,
  });

  return request.exec();
}
