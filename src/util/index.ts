import { IntegrationError } from '@jupiterone/integration-sdk-core';

export function buildKey(
  data: Record<string, string | boolean | number | undefined>,
): string {
  const keys = Object.keys(data);
  keys.sort();

  const parts: string[] = [];

  for (const key of keys) {
    const value = data[key];
    if (value != null) {
      parts.push(`${key}:${value}`);
    }
  }

  return parts.join('|');
}

export function getQualysHost(qualysApiUrl: string): string {
  const match = /https:\/\/qualysapi\.([-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*))/.exec(
    qualysApiUrl.trim(),
  );
  if (match) {
    return match[1];
  } else {
    throw new IntegrationError({
      code: 'QUALYS_API_URL_PARSE_ERROR',
      message: `Unexpected Qualys API URL format, parsing for host. Expected "https://qualysapi.(host)" but was ${JSON.stringify(
        qualysApiUrl,
      )}.`,
    });
  }
}

/**
 * Given an Array of values, drops undefined, null, duplicates and converts to
 * string. This needs to be as fast as possible. Feel free to improve performance.
 */
export function toStringArray(
  values: (string | number | undefined)[],
): string[] {
  const strings: string[] = [];
  for (const e of values) {
    if (e) {
      const s = String(e);
      if (strings.indexOf(s) === -1) {
        strings.push(s);
      }
    }
  }
  return strings;
}

/**
 * Await on a promise for a specific number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}
