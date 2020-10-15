const MILLISECONDS_ONE_DAY = 1000 * 60 * 60 * 24;

function getScannedSinceMs(days: number): number {
  if (process.env.VM_SCAN_SINCE_DAYS) {
    return parseInt(process.env.VM_SCAN_SINCE_DAYS) * MILLISECONDS_ONE_DAY;
  }

  if (process.env.VM_SCAN_SINCE_MS) {
    return parseInt(process.env.VM_SCAN_SINCE_MS);
  }

  return days * MILLISECONDS_ONE_DAY;
}

/**
 * @param scannedSinceDays the number of days since now when the environment
 * does not specify
 */
export function getScannedSinceDate(scannedSinceDays: number) {
  return new Date(Date.now() - getScannedSinceMs(scannedSinceDays))
    .toISOString()
    .replace(/\.\d{1,3}/, '');
}
