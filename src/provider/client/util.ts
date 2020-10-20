import { PossibleArray, RateLimitState } from './types';

export function toArray<T>(value: PossibleArray<T> | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function calculateConcurrency(state: RateLimitState): number {
  const running = state.concurrencyRunning;
  const available = Math.floor((state.concurrency - running) * 0.75);
  return available || 1;
}
