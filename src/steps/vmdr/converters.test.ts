import xmlParser from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

import { ListHostAssetsResponse } from '../../provider/client/types/assets';
import {
  DetectionHost,
  ListHostDetectionsResponse,
} from '../../provider/client/types/vmpc';
import { toArray } from '../../provider/client/util';
import {
  createEC2HostTargetEntity,
  createHostFindingEntity,
  getEC2HostArn,
  getHostDetails,
  getTargetsFromHostAsset,
} from './converters';

describe('createEC2HostTargetEntity', () => {
  const hostAssetsXml = fs
    .readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'test',
        'fixtures',
        'ec2-host-assets.xml',
      ),
    )
    .toString('utf8');

  const hostList = xmlParser.parse(hostAssetsXml) as ListHostAssetsResponse;

  test('properties transferred', () => {
    const hosts = toArray(hostList.ServiceResponse?.data?.HostAsset);

    for (const host of hosts) {
      const arn = getEC2HostArn(host);
      expect(createEC2HostTargetEntity(host)).toMatchGraphObjectSchema({
        _class: 'Host',
        schema: {
          properties: {
            _key: { const: arn },
            _type: { const: 'aws_instance' },
            accountId: { type: 'number' },
            state: { type: 'string' },
            instanceId: { type: 'string' },
            qualysFirstDiscoveredOn: { type: 'number' },
            qualysLastUpdatedOn: { type: 'number' },
            region: { type: 'string' },
            reservationId: { type: 'string' },
            availabilityZone: { type: 'string' },
            subnetId: { type: 'string' },
            vpcId: { type: 'string' },
            instanceType: { type: 'string' },
            imageId: { type: 'string' },
            privateDnsName: { type: 'string' },
            publicDnsName: { type: 'string' },
            'tag.Department': { type: 'string' },
          },
          required: [
            'qualysFirstDiscoveredOn',
            'qualysLastUpdatedOn',
            'accountId',
            'state',
            'instanceId',
            'region',
            'reservationId',
            'availabilityZone',
            'subnetId',
            'vpcId',
            'instanceType',
            'imageId',
            'privateDnsName',
            'publicDnsName',
            'publicIpAddress',
            'tag.Department',
          ],
        },
      });
    }
  });

  test('instanceState lowercased', () => {
    const host = toArray(hostList.ServiceResponse?.data?.HostAsset)[0];
    const ec2 = host.sourceInfo?.list?.Ec2AssetSourceSimple;
    expect(ec2?.instanceState).toMatch(/[A-Z]+/);
    expect((createEC2HostTargetEntity(host) as any).state).toMatch(/[a-z]+/);
  });
});

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
