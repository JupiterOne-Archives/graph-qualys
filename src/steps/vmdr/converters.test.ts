import xmlParser from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

import {
  HostAsset,
  ListHostAssetsResponse,
} from '../../provider/client/types/assets';
import {
  DetectionHost,
  ListHostDetectionsResponse,
} from '../../provider/client/types/vmpc';
import { toArray } from '../../provider/client/util';
import {
  createDiscoveredHostTargetEntity,
  createEC2HostTargetEntity,
  createHostFindingEntity,
  getEC2HostArn,
  getEC2HostTags,
  getHostDetails,
  getHostTags,
  getTargetsFromHostAsset,
  isTagsValid,
} from './converters';

describe('createDiscoveredHostTargetEntity', () => {
  let hosts: HostAsset[];

  beforeEach(() => {
    const hostAssetsXml = fs
      .readFileSync(
        path.join(
          __dirname,
          '..',
          '..',
          '..',
          'test',
          'fixtures',
          'list-host-assets.xml',
        ),
      )
      .toString('utf8');

    const hostList = xmlParser.parse(hostAssetsXml) as ListHostAssetsResponse;
    hosts = toArray(hostList.ServiceResponse?.data?.HostAsset);
  });

  test('properties transferred', () => {
    for (const host of hosts) {
      expect(createDiscoveredHostTargetEntity(host)).toMatchGraphObjectSchema({
        _class: 'Host',
        schema: {
          properties: {
            _type: { const: 'discovered_host' },
            qualysAssetId: { type: 'number' },
            qualysHostId: { type: 'number' },
            qualysCreatedOn: { type: 'number' },

            scannedBy: { type: 'string' },
            lastScannedOn: { type: 'number' },

            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }
  });

  test('required properties', () => {
    expect(createDiscoveredHostTargetEntity(hosts[0])).toMatchGraphObjectSchema(
      {
        _class: 'Host',
        schema: {
          required: [
            'hostname',
            'os',
            'platform',
            'qualysAssetId',
            'qualysHostId',
            'qualysCreatedOn',
            'scannedBy',
            'lastScannedOn',
            'name',
            'displayName',
            'tags',
          ],
        },
      },
    );
  });

  test('fqdn lowercased', () => {
    const host = hosts[0];
    expect(
      createDiscoveredHostTargetEntity({ ...host, fqdn: 'SOMETHING.com' }),
    ).toMatchObject({
      fqdn: 'something.com',
    });
  });

  test('tags', () => {
    expect(createDiscoveredHostTargetEntity(hosts[0])).toMatchObject({
      tags: ['Cloud Agent'],
    });
  });
});

describe('createEC2HostTargetEntity', () => {
  let hosts: HostAsset[];

  beforeEach(() => {
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
    hosts = toArray(hostList.ServiceResponse?.data?.HostAsset);
  });

  test('properties transferred', () => {
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
        },
      });
    }
  });

  test('required properties', () => {
    expect(createEC2HostTargetEntity(hosts[0])).toMatchGraphObjectSchema({
      _class: 'Host',
      schema: {
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
  });

  test('instanceState lowercased', () => {
    const host = hosts[0];
    const ec2 = host.sourceInfo?.list?.Ec2AssetSourceSimple;
    if (ec2) ec2.instanceState = 'STOPPED';
    expect(createEC2HostTargetEntity(host)).toMatchObject({
      state: 'stopped',
    });
  });

  test('tags', () => {
    const host = hosts[1];
    expect(createEC2HostTargetEntity(host)).toMatchObject({
      tags: ['Cloud Agent'],
    });
  });

  test('boolean ec2 tags', () => {
    const host = hosts[1];
    expect(
      createEC2HostTargetEntity({
        ...host,
        sourceInfo: {
          list: {
            Ec2AssetSourceSimple: {
              ec2InstanceTags: {
                tags: { list: { EC2Tags: [{ key: 'Boolean', value: true }] } },
              },
            },
          },
        },
      }),
    ).toMatchObject({
      tags: ['Cloud Agent', 'Boolean'],
      'tag.Boolean': true,
    });
  });

  test('number ec2 tags', () => {
    const host = hosts[1];
    expect(
      createEC2HostTargetEntity({
        ...host,
        sourceInfo: {
          list: {
            Ec2AssetSourceSimple: {
              ec2InstanceTags: {
                tags: { list: { EC2Tags: [{ key: 'Number', value: 1234 }] } },
              },
            },
          },
        },
      }),
    ).toMatchObject({
      tags: ['Cloud Agent'],
      'tag.Number': 1234,
    });
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

describe('getHostTags older XML', () => {
  function hostFromXml(xml: string): HostAsset {
    return xmlParser.parse(xml);
  }

  test('one tag', () => {
    expect(
      getHostTags(
        hostFromXml(
          `<tags>
            <TAG>
              <TAG_ID>123</TAG_ID>
              <NAME>TheName</NAME>
            </TAG>
          </tags>`,
        ),
      ),
    ).toEqual(['TheName']);
  });

  test('multiple tags', () => {
    expect(
      getHostTags(
        hostFromXml(
          `<tags>
            <TAG>
              <TAG_ID>123</TAG_ID>
              <NAME>TheName</NAME>
            </TAG>
            <TAG>
              <TAG_ID>456</TAG_ID>
              <NAME>AnotherName</NAME>
            </TAG>
          </tags>`,
        ),
      ),
    ).toEqual(['TheName', 'AnotherName']);
  });

  test('no tags list', () => {
    expect(getHostTags(hostFromXml(`<tags></tags>`))).toEqual([]);
  });

  test('empty tag data', () => {
    expect(
      getHostTags(
        hostFromXml(
          `<tags>
            <TAG></TAG>
          </tags>`,
        ),
      ),
    ).toEqual([]);
  });

  test('unexpected tag data', () => {
    expect(
      getHostTags(
        hostFromXml(
          `<tags>
            <TAG>
              <TAG_ID>123</TAG_ID>
              <NAME><obj>TheName</obj></NAME>
            </TAG>
          </tags>`,
        ),
      ),
    ).toEqual([]);
  });
});

describe('getHostTags api-v2 XML', () => {
  function hostFromXml(xml: string): HostAsset {
    return xmlParser.parse(xml);
  }

  test('one tag', () => {
    expect(
      getHostTags(
        hostFromXml(
          `<tags><list>
            <TagSimple>
              <id>123</id>
              <name>TheName</name>
            </TagSimple>
          </list></tags>`,
        ),
      ),
    ).toEqual(['TheName']);
  });

  test('multiple tags', () => {
    expect(
      getHostTags(
        hostFromXml(
          `<tags><list>
            <TagSimple>
              <id>123</id>
              <name>TheName</name>
            </TagSimple>
            <TagSimple>
              <id>456</id>
              <name>AnotherName</name>
            </TagSimple>
          </list></tags>`,
        ),
      ),
    ).toEqual(['TheName', 'AnotherName']);
  });

  test('empty tags list', () => {
    expect(getHostTags(hostFromXml(`<tags><list/></tags>`))).toEqual([]);
  });

  test('no tags', () => {
    expect(getHostTags(hostFromXml(``))).toEqual([]);
  });

  test('no tags list', () => {
    expect(getHostTags(hostFromXml(`<tags></tags>`))).toEqual([]);
  });

  test('empty tag data', () => {
    expect(
      getHostTags(
        hostFromXml(
          `<tags><list>
            <TagSimple></TagSimple>
          </list></tags>`,
        ),
      ),
    ).toEqual([]);
  });

  test('unexpected tag data', () => {
    expect(
      getHostTags(
        hostFromXml(
          `<tags><list>
            <TagSimple>
              <id>123</id>
              <name><obj>TheName</obj></name>
            </TagSimple>
          </list></tags>`,
        ),
      ),
    ).toEqual([]);
  });
});

describe('getEC2HostTags', () => {
  function hostFromXml(xml: string): HostAsset {
    return xmlParser.parse(xml);
  }

  test('one tag', () => {
    expect(
      getEC2HostTags(
        hostFromXml(
          `<sourceInfo>
            <list>
              <Ec2AssetSourceSimple>
                <ec2InstanceTags>
                  <tags>
                    <list>
                      <EC2Tags>
                        <key>Department</key>
                        <value>Security</value>
                      </EC2Tags>
                    </list>
                  </tags>
                </ec2InstanceTags>
              </Ec2AssetSourceSimple>
            </list>
          </sourceInfo>`,
        ),
      ),
    ).toEqual([{ key: 'Department', value: 'Security' }]);
  });

  test('multiple tags', () => {
    expect(
      getEC2HostTags(
        hostFromXml(
          `<sourceInfo>
            <list>
              <Ec2AssetSourceSimple>
                <ec2InstanceTags>
                  <tags>
                    <list>
                      <EC2Tags>
                        <key>Department</key>
                        <value>Security</value>
                      </EC2Tags>
                      <EC2Tags>
                        <key>Owner</key>
                        <value>Bob</value>
                      </EC2Tags>
                    </list>
                  </tags>
                </ec2InstanceTags>
              </Ec2AssetSourceSimple>
            </list>
          </sourceInfo>`,
        ),
      ),
    ).toEqual([
      { key: 'Department', value: 'Security' },
      { key: 'Owner', value: 'Bob' },
    ]);
  });

  test('no Ec2AssetSourceSimple', () => {
    expect(
      getEC2HostTags(hostFromXml(`<sourceInfo><list/></sourceInfo>`)),
    ).toEqual([]);
  });

  test('no ec2InstanceTags', () => {
    expect(
      getEC2HostTags(
        hostFromXml(`<sourceInfo>
                      <list>
                        <Ec2AssetSourceSimple/>
                      </list>
                    </sourceInfo>`),
      ),
    ).toEqual([]);
  });

  test('empty tags list', () => {
    expect(
      getEC2HostTags(
        hostFromXml(`<sourceInfo>
                      <list>
                        <Ec2AssetSourceSimple>
                          <ec2InstanceTags>
                            <tags>
                              <list/>
                            </tags>
                          </ec2InstanceTags>
                        </Ec2AssetSourceSimple>
                      </list>
                    </sourceInfo>`),
      ),
    ).toEqual([]);
  });

  test('no sourceInfo', () => {
    expect(getEC2HostTags(hostFromXml(``))).toEqual([]);
  });

  test('empty tag data', () => {
    expect(
      getEC2HostTags(
        hostFromXml(
          `<sourceInfo>
            <list>
              <Ec2AssetSourceSimple>
                <ec2InstanceTags>
                  <tags>
                    <list>
                      <EC2Tags>
                      </EC2Tags>
                      <EC2Tags>
                        <key>Owner</key>
                        <value>Bob</value>
                      </EC2Tags>
                    </list>
                  </tags>
                </ec2InstanceTags>
              </Ec2AssetSourceSimple>
            </list>
          </sourceInfo>`,
        ),
      ),
    ).toEqual([{ key: 'Owner', value: 'Bob' }]);
  });

  test('unexpected tag data', () => {
    expect(
      getEC2HostTags(
        hostFromXml(
          `<sourceInfo>
            <list>
              <Ec2AssetSourceSimple>
                <ec2InstanceTags>
                  <tags>
                    <list>
                      <EC2Tags>
                        <key>Department</key>
                        <value><obj>Security</obj></value>
                      </EC2Tags>
                      <EC2Tags>
                        <key>Owner</key>
                        <value>Bob</value>
                      </EC2Tags>
                    </list>
                  </tags>
                </ec2InstanceTags>
              </Ec2AssetSourceSimple>
            </list>
          </sourceInfo>`,
        ),
      ),
    ).toEqual([{ key: 'Owner', value: 'Bob' }]);
  });
});

describe('isTagsValid', () => {
  test('none', () => {
    expect(isTagsValid({})).toBe(true);
  });
  test('string', () => {
    expect(isTagsValid({ tags: 'tag' })).toBe(true);
  });
  test('string[]', () => {
    expect(isTagsValid({ tags: ['tag'] })).toBe(true);
  });
  test('mixed array', () => {
    expect(isTagsValid({ tags: ['tag', { key: 'no!' }] as any })).toBe(false);
  });
  test('who knows', () => {
    expect(isTagsValid({ tags: { dont: 'know' } as any })).toBe(false);
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
