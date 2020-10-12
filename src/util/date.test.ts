import { getVmScanSinceDate } from './date';

describe('#getVmScanSinceDate', () => {
  afterEach(() => {
    process.env.VM_SCAN_SINCE_DAYS = undefined;
    jest.resetAllMocks();
  });

  test('should default to 30 days', () => {
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 1602528224084);
    expect(getVmScanSinceDate()).toEqual('2020-09-12T18:43:44Z');
  });

  test('should allow configuring range using environment variable', () => {
    jest.spyOn(Date, 'now').mockImplementationOnce(() => 1602528224084);
    process.env.VM_SCAN_SINCE_DAYS = '7';
    expect(getVmScanSinceDate()).toEqual('2020-10-05T18:43:44Z');
  });
});
