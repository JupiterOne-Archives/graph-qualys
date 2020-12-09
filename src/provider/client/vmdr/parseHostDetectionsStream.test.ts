import { Readable } from 'stream';

import { parseHostDetectionsStream } from './parseHostDetectionsStream';

class ReadableString extends Readable {
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

test('unknown xml', async () => {
  const iteratee = jest.fn();
  const xmlStream = new ReadableString('<unknown></unknown>');
  await expect(
    parseHostDetectionsStream(xmlStream, iteratee),
  ).resolves.not.toThrowError();
  expect(iteratee).not.toHaveBeenCalled();
});

test('no content', async () => {
  const iteratee = jest.fn();
  const xmlStream = new ReadableString('');
  await expect(
    parseHostDetectionsStream(xmlStream, iteratee),
  ).resolves.not.toThrowError();
  expect(iteratee).not.toHaveBeenCalled();
});

test('empty HOST_LIST', async () => {
  const iteratee = jest.fn();
  const xmlStream = new ReadableString(
    '<HOST_LIST_VM_DETECTION_OUTPUT>\
  <RESPONSE>\
     <DATETIME>2020-09-27T01:29:21Z</DATETIME>\
     <HOST_LIST>\
     </HOST_LIST>\
  </RESPONSE>\
</HOST_LIST_VM_DETECTION_OUTPUT>',
  );
  await expect(
    parseHostDetectionsStream(xmlStream, iteratee),
  ).resolves.not.toThrowError();
  expect(iteratee).not.toHaveBeenCalled();
});

test('HOST, empty DETECTION_LIST', async () => {
  const iteratee = jest.fn();
  const xmlStream = new ReadableString(
    '<HOST_LIST_VM_DETECTION_OUTPUT>\
  <RESPONSE>\
    <DATETIME>2020-09-27T01:29:21Z</DATETIME>\
    <HOST_LIST>\
      <HOST>\
        <ID>123</ID>\
        <IP>10.10.10.11</IP>\
        <OS><![CDATA[Windows 2008 R2 Enterprise Service Pack1]]></OS>\
        <LAST_SCAN_DATETIME>2018-04-13T03:49:05Z</LAST_SCAN_DATETIME>\
        <DETECTION_LIST></DETECTION_LIST>\
      </HOST>\
    </HOST_LIST>\
  </RESPONSE>\
</HOST_LIST_VM_DETECTION_OUTPUT>',
  );
  await expect(
    parseHostDetectionsStream(xmlStream, iteratee),
  ).resolves.not.toThrowError();
  expect(iteratee).toHaveBeenCalledWith({
    detections: [],
    host: {
      id: 123,
      ip: '10.10.10.11',
      lastScanDatetime: '2018-04-13T03:49:05Z',
      os: 'Windows 2008 R2 Enterprise Service Pack1',
    },
  });
});

test('HOSTs, DETECTIONs', async () => {
  const iteratee = jest.fn();
  const xmlStream = new ReadableString(
    '<HOST_LIST_VM_DETECTION_OUTPUT>\
  <RESPONSE>\
    <DATETIME>2020-09-27T01:29:21Z</DATETIME>\
    <HOST_LIST>\
      <HOST>\
        <LAST_SCAN_DATETIME>2018-04-13T03:49:05Z</LAST_SCAN_DATETIME>\
        <DETECTION_LIST>\
          <DETECTION>\
            <QID>38170</QID>\
            <TYPE>Confirmed</TYPE>\
            <SEVERITY>2</SEVERITY>\
            <PORT>3389</PORT>\
          </DETECTION>\
        </DETECTION_LIST>\
      </HOST>\
      <HOST>\
        <LAST_SCAN_DATETIME>2018-04-13T03:49:05Z</LAST_SCAN_DATETIME>\
        <DETECTION_LIST>\
          <DETECTION>\
            <QID>38170</QID>\
            <TYPE>Confirmed</TYPE>\
            <SEVERITY>2</SEVERITY>\
            <PORT>3389</PORT>\
          </DETECTION>\
          <DETECTION>\
            <QID>38171</QID>\
            <TYPE>Unconfirmed</TYPE>\
            <SEVERITY>1</SEVERITY>\
            <PORT>3489</PORT>\
          </DETECTION>\
        </DETECTION_LIST>\
      </HOST>\
    </HOST_LIST>\
  </RESPONSE>\
</HOST_LIST_VM_DETECTION_OUTPUT>',
  );
  await expect(
    parseHostDetectionsStream(xmlStream, iteratee),
  ).resolves.not.toThrowError();
  expect(iteratee).toHaveBeenNthCalledWith(1, {
    host: {
      lastScanDatetime: '2018-04-13T03:49:05Z',
    },
    detections: [
      {
        port: 3389,
        qid: 38170,
        severity: 2,
        type: 'Confirmed',
      },
    ],
  });
  expect(iteratee).toHaveBeenNthCalledWith(2, {
    host: {
      lastScanDatetime: '2018-04-13T03:49:05Z',
    },
    detections: [
      {
        port: 3389,
        qid: 38170,
        severity: 2,
        type: 'Confirmed',
      },
      {
        port: 3489,
        qid: 38171,
        severity: 1,
        type: 'Unconfirmed',
      },
    ],
  });
});
