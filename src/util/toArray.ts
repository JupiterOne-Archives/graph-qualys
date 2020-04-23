import { PossibleArray } from '../types';

export default function toArray<T>(value: PossibleArray<T> | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
