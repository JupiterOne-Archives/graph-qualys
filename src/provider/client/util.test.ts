import { RateLimitState } from './types';
import { calculateConcurrency } from './util';

describe('calculateConcurrency', () => {
  function state(values?: Partial<RateLimitState>): RateLimitState {
    return {
      limit: 300,
      limitRemaining: 300,
      limitWindowSeconds: 60 * 60,
      toWaitSeconds: 0,
      concurrency: 2,
      concurrencyRunning: 0,
      ...values,
    };
  }

  test.each([
    // Always allow at least one request.
    [0, 0, 0, 1],
    [1, 0, 0, 1],
    [0, 1, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 1],
    [0, 2, 0, 1],
    [1, 2, 0, 1],
    [0, 2, 1, 1],
    [1, 2, 1, 1],
    [0, 2, 2, 1],
    [1, 2, 2, 1],

    // Use %75 of total to leave some for other scripts.
    [0, 15, 0, 11],

    // Handle case where it looks like another script is busy with the
    // connections, don't take more than ~75% of what's left to leave room for
    // other scripts.
    [0, 15, 5, 7],
    [0, 15, 9, 4],

    // Assume this script is the one that is active, so allow it more room.
    [5, 15, 5, 11],

    // Others appear to be active while this one is, but there isn't any reason
    // to avoid allowing more.
    [4, 15, 9, 11],

    // Handle cases where we consider ourselves active, but the server has
    // completed one or all responses.
    [5, 15, 0, 11],
    [11, 15, 2, 11],
  ])(
    'active: %s, concurrency: %s, running: %s',
    (active, concurrency, concurrencyRunning, expected) => {
      expect(
        calculateConcurrency(
          active,
          state({ concurrency, concurrencyRunning }),
        ),
      ).toEqual(expected);
    },
  );
});
