import PQueue from 'p-queue';

import { ClientEventEmitter } from './request';
import { ClientEvents, ClientResponseEvent, RateLimitState } from './types';

/**
 * The following considerations have been taken into account:
 *
 *   - Qualys API docs indicate `X-Concurrency-Limit-Running` is "Number of
 *     API calls that are running right now (including the one identified in
 *     the current HTTP response header)."
 *   - The response headers come back before the stream is completely
 *     processed.
 *   - Until the stream has been completely processed, the request should be
 *     considered active.
 *   - The queue needs to be throttled back as soon as we know we cannot
 *     make more requests, and throttled up as soon as we know more can be
 *     made.
 */
export async function withConcurrency(
  fn: (queue: PQueue) => void,
  {
    events,
    rateLimitState,
  }: {
    events: ClientEventEmitter;
    rateLimitState: RateLimitState;
  },
): Promise<void> {
  /**
   * Number of concurrent requests in progress according to the server endpoint
   * responses, updated on each response that includes the information.
   * Initialized from the provided `rateLimitState`.
   */
  let reportedConcurrencyLimit = rateLimitState.concurrency;

  /**
   * Number of concurrent requests according to the server endpoint, updated on
   * each response that includes the information.
   */
  let reportedConcurrencyRunning = 0;

  /**
   * Number of concurrent requests according to the number of requests
   * generated, based on the last `reportedConcurrencyRunning`.
   *
   * This is necessary to ensure that even when we've not received a response,
   * but started additional requests, we help to avoid exceeding capacity. Of
   * course, other threads could have taken availability, so we still have to
   * handle rate limited responses well in retry code.
   */
  let concurrencyRunning = 0;

  /**
   * Number of queue Promises currently running, including the time to send the
   * request, stream over the body, and process its content.
   *
   * This must be tracked according to [p-queue
   * documentation](https://github.com/sindresorhus/p-queue#events).
   */
  let concurrencyQueueActive = 0;

  /**
   * Limit number of concurrent work to number of concurrent requests supported by
   * the `rateLimitState`.
   */
  const concurrencyQueue = new PQueue({
    concurrency: calculateConcurrency(
      0,
      reportedConcurrencyLimit,
      reportedConcurrencyRunning,
    ),
  });

  concurrencyQueue.on('active', () => {
    concurrencyQueueActive++;
    concurrencyRunning++;
  });
  concurrencyQueue.on('next', () => {
    concurrencyQueueActive--;
    concurrencyQueue.concurrency = calculateConcurrency(
      concurrencyQueueActive,
      reportedConcurrencyLimit,
      concurrencyRunning,
    );
  });

  /**
   * Updates queue concurrency dynamically depending on availability reported
   * by the API service endpoint.
   */
  const concurrencyResponseListener = events.on(
    ClientEvents.RESPONSE,
    (event: ClientResponseEvent) => {
      reportedConcurrencyLimit = event.rateLimitState.concurrency;
      reportedConcurrencyRunning = event.rateLimitState.concurrencyRunning;
      concurrencyRunning = reportedConcurrencyRunning;
    },
  );

  fn(concurrencyQueue);

  await concurrencyQueue.onIdle();

  events.removeListener(concurrencyResponseListener);
}

/**
 * Calculates the number of concurrent connections this process can maintain
 * with the server represented by the provided state, targeting 75% of available
 * concurrency (always leaves something open to other scripts).
 *
 * It is important to recognize that the current process is responsible for some
 * of the active use of the available concurrency limits of the server.
 * Therefore, this function must be careful to avoid pushing down the number of
 * maintained active connections inadvertently.
 *
 * @param active number of active connections from this process
 * @param limit concurrency limit of server provided in most recent response
 * @param running concurrency running of server provided in most recent response
 */
export function calculateConcurrency(
  active: number,
  limit: number,
  running: number,
): number {
  const otherRunning = Math.max(running ? running - active : 0, 0);
  const available = Math.floor((limit - otherRunning) * 0.75);
  return available > 0 ? available : 1;
}
