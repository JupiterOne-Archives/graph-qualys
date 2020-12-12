import stream from 'stream';

import {
  DETECTION_COLUMN_PROPERTY_MAP,
  parseHostDetectionsCSVStream,
} from './parseHostDetectionsCSVStream';
import { vmpc } from '../types';

class ReadableString extends stream.Readable {
  private sent = false;

  constructor(private str: string) {
    super();
  }

  _read() {
    if (!this.sent) {
      this.push(Buffer.from(this.str));
      this.sent = true;
    } else {
      this.push(null);
    }
  }
}

const hostCSV1 =
  '"1","18.232.119.203","IP","Amazon Linux","ec2-18-232-119-203.compute-1.amazonaws.com",,,"2018-04-13T03:49:05Z",,"2020-11-19T15:28:08Z","421",,,,"38170","Confirmed","3389","tcp",,"0",,"New","2","2020-11-19T15:28:08Z","2020-11-19T15:28:08Z","2020-11-19T15:28:08Z","2018-04-13T03:49:05Z",,,,,"Type	Name\
key exchange	diffie-hellman-group1-sha1\
cipher	blowfish-cbc\
cipher	cast128-cbc\
cipher	3des-cbc","0","0","1",,,"2018-04-13T03:49:05Z"\
';

const hostCSV2 =
  '"2","18.232.119.203","IP","Amazon Linux","ec2-18-232-119-203.compute-1.amazonaws.com",,,"2018-04-13T03:49:05Z",,"2020-11-19T15:28:08Z","421",,,,"38170","Confirmed","3389","tcp",,"0",,"New","2","2020-11-19T15:28:08Z","2020-11-19T15:28:08Z","2020-11-19T15:28:08Z","2018-04-13T03:49:05Z",,,,,"Type	Name\
key exchange	diffie-hellman-group1-sha1\
cipher	blowfish-cbc\
cipher	cast128-cbc\
cipher	3des-cbc","0","0","1",,,"2018-04-13T03:49:05Z"\
"2","18.232.119.203","IP","Amazon Linux","ec2-18-232-119-203.compute-1.amazonaws.com",,,"2018-04-13T03:49:05Z",,"2020-11-19T15:28:08Z","421",,,,"38171","Confirmed","3389","tcp",,"0",,"New","1","2020-11-19T15:28:08Z","2020-11-19T15:28:08Z","2020-11-19T15:28:08Z","2018-04-13T03:49:05Z",,,,,"Type	Name\
key exchange	diffie-hellman-group1-sha1\
cipher	blowfish-cbc\
cipher	cast128-cbc\
cipher	3des-cbc","0","0","1",,,"2018-04-13T03:49:05Z"\
';

const hostCSV3 =
  '"3","18.232.119.203","IP","Amazon Linux","ec2-18-232-119-203.compute-1.amazonaws.com",,,"2018-04-13T03:49:05Z",,"2020-11-19T15:28:08Z","421",,,,"38171","Confirmed","3389","tcp",,"0",,"New","1","2020-11-19T15:28:08Z","2020-11-19T15:28:08Z","2020-11-19T15:28:08Z","2018-04-13T03:49:05Z",,,,,"Type	Name\
key exchange	diffie-hellman-group1-sha1\
cipher	blowfish-cbc\
cipher	cast128-cbc\
cipher	3des-cbc","0","0","1",,,"2018-04-13T03:49:05Z"\
';

const detectionOutputOpenCSV =
  '----BEGIN_RESPONSE_HEADER_CSV\
  ----END_RESPONSE_HEADER_CSV\
  ----BEGIN_RESPONSE_BODY_CSV\
  "Host ID","IP Address","Tracking Method","Operating System","DNS Name","Netbios Name","QG HostID","Last Scan Datetime","OS CPE","Last VM Scanned Date","Last VM Scanned Duration","Last VM Auth Scanned Date","Last VM Auth Scanned Duration","Last PC Scanned Date","QID","Type","Port","Protocol","FQDN","SSL","Instance","Status","Severity","First Found Datetime","Last Found Datetime","Last Test Datetime","Last Update Datetime","Last Fixed Datetime","First Re-opened Datetime","Last Re-opened Datetime","Times Re-opened","Results","Ignored","Disabled","Times Found","Service","Affect Running Kernel","Last Processed Datetime"\
';

const detectionOutputCloseCSV =
  '----END_RESPONSE_BODY_CSV\
  ----BEGIN_RESPONSE_FOOTER_CSV\
  "Status Message"\
  "Finished"\
  ----END_RESPONSE_FOOTER_CSV\
';

const detectionOutputCSV = `${detectionOutputOpenCSV}
    ${hostCSV1}
    ${hostCSV2}
    ${hostCSV3}
  ${detectionOutputCloseCSV}`;

const hostDetections1: vmpc.HostDetections = {
  host: {
    ID: 1,
    LAST_SCAN_DATETIME: '2018-04-13T03:49:05Z' as any,
  },
  detections: [
    {
      PORT: 3389,
      QID: 38170,
      SEVERITY: 2,
      TYPE: 'Confirmed',
    },
  ],
};

const hostDetections2: vmpc.HostDetections = {
  host: {
    ID: 2,
    LAST_SCAN_DATETIME: '2018-04-13T03:49:05Z' as any,
  },
  detections: [
    {
      PORT: 3389,
      QID: 38170,
      SEVERITY: 2,
      TYPE: 'Confirmed',
    },
    {
      PORT: 3489,
      QID: 38171,
      SEVERITY: 1,
      TYPE: 'Unconfirmed',
    },
  ],
};

const hostDetections3: vmpc.HostDetections = {
  host: {
    ID: 3,
    LAST_SCAN_DATETIME: '2018-04-13T03:49:05Z' as any,
  },
  detections: [],
};

describe('DETECTION_COLUMN_PROPERTY_MAP', () => {
  test.each([
    ['Host ID', 'ID'],
    ['Tracking Method', 'TRACKING_METHOD'],
    ['Last VM Scanned Date', 'LAST_VM_SCANNED_DATE'],
  ])('%s -> %s', (columnName, propertyName) => {
    expect(DETECTION_COLUMN_PROPERTY_MAP[columnName]).toEqual(propertyName);
  });
});

test('unknown xml', async () => {
  const iteratee = jest.fn();
  const onIterateeError = jest.fn();
  const csvStream = new ReadableString('unknown content');
  await expect(
    parseHostDetectionsCSVStream({ csvStream, iteratee, onIterateeError }),
  ).resolves.not.toThrowError();
  expect(onIterateeError).not.toHaveBeenCalled();
  expect(iteratee).not.toHaveBeenCalled();
});

test('no content', async () => {
  const iteratee = jest.fn();
  const onIterateeError = jest.fn();
  const csvStream = new ReadableString('');
  await expect(
    parseHostDetectionsCSVStream({ csvStream, iteratee, onIterateeError }),
  ).resolves.not.toThrowError();
  expect(onIterateeError).not.toHaveBeenCalled();
  expect(iteratee).not.toHaveBeenCalled();
});

test('empty response body CSV', async () => {
  const iteratee = jest.fn();
  const onIterateeError = jest.fn();
  const csvStream = new ReadableString(
    '----BEGIN_RESPONSE_HEADER_CSV\
----END_RESPONSE_HEADER_CSV\
----BEGIN_RESPONSE_BODY_CSV\
----END_RESPONSE_BODY_CSV\
----BEGIN_RESPONSE_FOOTER_CSV\
"Status Message"\
"Finished"\
----END_RESPONSE_FOOTER_CSV\
',
  );
  await expect(
    parseHostDetectionsCSVStream({ csvStream, iteratee, onIterateeError }),
  ).resolves.not.toThrowError();
  expect(onIterateeError).not.toHaveBeenCalled();
  expect(iteratee).not.toHaveBeenCalled();
});

test.only('one host, one detection', async () => {
  const iteratee = jest.fn();
  const onIterateeError = jest.fn();

  const csvStream = new ReadableString(
    '----BEGIN_RESPONSE_HEADER_CSV\
----END_RESPONSE_HEADER_CSV\
----BEGIN_RESPONSE_BODY_CSV\
"Host ID","IP Address","Tracking Method","Operating System","DNS Name","Netbios Name","QG HostID","Last Scan Datetime","OS CPE","Last VM Scanned Date","Last VM Scanned Duration","Last VM Auth Scanned Date","Last VM Auth Scanned Duration","Last PC Scanned Date","QID","Type","Port","Protocol","FQDN","SSL","Instance","Status","Severity","First Found Datetime","Last Found Datetime","Last Test Datetime","Last Update Datetime","Last Fixed Datetime","First Re-opened Datetime","Last Re-opened Datetime","Times Re-opened","Results","Ignored","Disabled","Times Found","Service","Affect Running Kernel","Last Processed Datetime"\
"113574008","18.232.119.203","IP","Amazon Linux","ec2-18-232-119-203.compute-1.amazonaws.com",,,"2020-11-19T15:29:50Z",,"2020-11-19T15:28:08Z","421",,,,"38739","Confirmed","22","tcp",,"0",,"New","2","2020-11-19T15:28:08Z","2020-11-19T15:28:08Z","2020-11-19T15:28:08Z","2020-11-19T15:29:50Z",,,,,"Type	Name\
key exchange	diffie-hellman-group1-sha1\
cipher	blowfish-cbc\
cipher	cast128-cbc\
cipher	3des-cbc","0","0","1",,,"2020-11-19T15:29:50Z"\
----END_RESPONSE_BODY_CSV\
----BEGIN_RESPONSE_FOOTER_CSV\
"Status Message"\
"Finished"\
----END_RESPONSE_FOOTER_CSV\
',
  );

  await expect(
    parseHostDetectionsCSVStream({
      csvStream,
      iteratee,
      onIterateeError,
      debug: true,
    }),
  ).resolves.not.toThrowError();

  expect(onIterateeError).not.toHaveBeenCalled();
  expect(iteratee).toHaveBeenCalledWith({
    detections: [],
    host: {
      ID: 123,
      IP: '10.10.10.11',
      LAST_SCAN_DATETIME: '2018-04-13T03:49:05Z',
      OS: 'Windows 2008 R2 Enterprise Service Pack1',
    },
  });
});

// test('stream', async () => {
//   const csvStream = new ReadableString(detectionOutputCSV);
//   const iteratee = jest.fn();
//   const onIterateeError = jest.fn();
//   await parseHostDetectionsCSVStream({ csvStream, iteratee, onIterateeError });
//   expect(iteratee).toHaveBeenCalledTimes(3);
//   expect(onIterateeError).not.toHaveBeenCalled();
// });
