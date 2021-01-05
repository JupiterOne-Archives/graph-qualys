import { calculateConcurrency } from './util';

describe('calculateConcurrency', () => {
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
    [7, 15, 14, 6],

    // Assume this script is the one that is active, so allow it more room.
    [5, 15, 5, 11],

    // Others appear to be active while this one is, but there isn't any reason
    // to avoid allowing more.
    [4, 15, 9, 7],
    [7, 15, 8, 10],

    // Handle cases where we consider ourselves active, but the server has
    // completed one or all responses.
    [5, 15, 0, 11],
    [11, 15, 2, 11],

    // Drive down our connections when something seems out of place.
    [15, 15, 9, 11],
  ])(
    'active: %s, concurrency: %s, running: %s',
    (active, concurrency, concurrencyRunning, expected) => {
      expect(
        calculateConcurrency(active, concurrency, concurrencyRunning),
      ).toEqual(expected);
    },
  );
});
