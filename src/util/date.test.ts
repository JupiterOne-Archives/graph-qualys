import { getVmScanSinceDate } from './date';

describe('#getVmScanSinceDate', () => {
  beforeEach(() => {
    delete process.env.VM_SCAN_SINCE_DAYS;
    delete process.env.VM_SCAN_SINCE_MS;
    jest.resetAllMocks();
  });

  test('should default to 30 days', () => {
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 1602528224084);
    expect(getVmScanSinceDate()).toEqual('2020-09-12T18:43:44Z');
  });

  test('should allow configuring range in days using environment variable', () => {
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 1602528224084);
    process.env.VM_SCAN_SINCE_DAYS = '7';
    expect(getVmScanSinceDate()).toEqual('2020-10-05T18:43:44Z');
  });

  test('should allow configuring range in milliseconds using environment variable', () => {
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 1602528224084);
    process.env.VM_SCAN_SINCE_MS = '3600000';
    expect(getVmScanSinceDate()).toEqual('2020-10-12T17:43:44Z');
  });
});
