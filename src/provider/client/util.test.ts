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
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [2, 0, 1],
    [2, 1, 1],
    [2, 2, 1],
    [15, 0, 11],
    [15, 5, 7],
    [15, 9, 4],
  ])(
    'concurrency: %s, running: %s',
    (concurrency, concurrencyRunning, expected) => {
      expect(
        calculateConcurrency(state({ concurrency, concurrencyRunning })),
      ).toEqual(expected);
    },
  );
});
