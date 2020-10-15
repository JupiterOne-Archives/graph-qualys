import { getScannedSinceDate } from './date';

describe('#getVmScanSinceDate', () => {
  beforeEach(() => {
    delete process.env.VM_SCAN_SINCE_DAYS;
    delete process.env.VM_SCAN_SINCE_MS;
    jest.resetAllMocks();
  });

  test('provided days', () => {
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 1602528224084);
    expect(getScannedSinceDate(30)).toEqual('2020-09-12T18:43:44Z');
  });

  test('VM_SCAN_SINCE_DAYS environment variable', () => {
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 1602528224084);
    process.env.VM_SCAN_SINCE_DAYS = '7';
    expect(getScannedSinceDate(30)).toEqual('2020-10-05T18:43:44Z');
  });

  test('VM_SCAN_SINCE_MS environment variable', () => {
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 1602528224084);
    process.env.VM_SCAN_SINCE_MS = '3600000';
    expect(getScannedSinceDate(30)).toEqual('2020-10-12T17:43:44Z');
  });
});
