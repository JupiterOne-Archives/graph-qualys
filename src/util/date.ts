const MILLISECONDS_ONE_DAY = 1000 * 60 * 60 * 24;
const MAX_LAST_SCAN_AGE = 30 * MILLISECONDS_ONE_DAY;

function getVmScanSince() {
  if (process.env.VM_SCAN_SINCE_DAYS) {
    return parseInt(process.env.VM_SCAN_SINCE_DAYS) * MILLISECONDS_ONE_DAY;
  }

  if (process.env.VM_SCAN_SINCE_MS) {
    return parseInt(process.env.VM_SCAN_SINCE_MS);
  }

  return MAX_LAST_SCAN_AGE;
}

export function getVmScanSinceDate() {
  return new Date(Date.now() - getVmScanSince())
    .toISOString()
    .replace(/\.\d{1,3}/, '');
}
