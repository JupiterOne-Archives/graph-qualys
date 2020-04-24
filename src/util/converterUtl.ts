import { ISODateString } from '../types';

export function convertISODateStringToTimestamp(
  isoDateString: ISODateString | undefined,
): number | undefined {
  if (!isoDateString) {
    return undefined;
  }
  return Date.parse(isoDateString);
}
