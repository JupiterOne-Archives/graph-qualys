import xmlParser from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

import {
  DetectionHost,
  ListHostDetectionsResponse,
} from '../../provider/client/types/vmpc';
import { toArray } from '../../provider/client/util';
import {
  createHostFindingEntity,
  getHostDetails,
  getTargetsFromHostAsset,
} from './converters';

describe('createHostFindingEntity', () => {
  const detectionsXml = fs
    .readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'test',
        'fixtures',
        'detections.xml',
      ),
    )
    .toString('utf8');

  const detectionsList = xmlParser.parse(
    detectionsXml,
  ) as ListHostDetectionsResponse;

  test('properties transferred', () => {
    const detectionHosts: DetectionHost[] = toArray(
      detectionsList.HOST_LIST_VM_DETECTION_OUTPUT?.RESPONSE?.HOST_LIST?.HOST,
    );
    for (const detectionHost of detectionHosts) {
      for (const hostDetection of toArray(
        detectionHost.DETECTION_LIST?.DETECTION,
      )) {
        const hostTargets = ['abc', '123'];
        expect(
          createHostFindingEntity(
            'finding-key',
            detectionHost,
            hostDetection,
            hostTargets,
          ),
        ).toMatchGraphObjectSchema({
          _class: 'Finding',
        });
      }
    }
  });
});

describe('getHostDetails', () => {
  test('non-string os', () => {
    // https://qualysapi.qualys.com/qps/xsd/2.0/am/hostasset.xsd says it should
    // be a string, but we received `os.toLowerCase is not a function` in
    // production 🤷🏼‍♂️
    expect(getHostDetails({ os: {} })).toMatchObject({
      os: undefined,
    });
  });

  test('normalizes fqdn', () => {
    expect(getHostDetails({ fqdn: 'THIS.IS.MY.HOST' })).toMatchObject({
      fqdn: 'this.is.my.host',
    });
    expect(getHostDetails({ fqdn: undefined })).toMatchObject({
      fqdn: undefined,
    });
  });
});

describe('getTargetsFromHostAsset', () => {
  test('deduplicates values', () => {
    expect(
      getTargetsFromHostAsset({ dnsHostName: 'bob', fqdn: 'bob' }),
    ).toEqual(['bob']);
  });

  test('normalizes fqdn', () => {
    expect(getTargetsFromHostAsset({ fqdn: 'THIS.IS.MY.HOST' })).toEqual([
      'this.is.my.host',
    ]);
    expect(getTargetsFromHostAsset({ fqdn: undefined })).toEqual([]);
  });
});
