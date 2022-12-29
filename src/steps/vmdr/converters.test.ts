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
  createDiscoveredHostAssetTargetEntity,
  createEC2HostAssetTargetEntity,
  createGCPHostAssetTargetEntity,
  createHostFindingEntity,
  getEC2HostAccountId,
  getEC2HostAssetArn,
  getEC2HostAssetTags,
  getGCPHostAssetSelfLink,
  getHostAssetDetails,
  getHostAssetFqdn,
  getHostAssetTags,
  getHostAssetTargets,
  isTagsValid,
} from './converters';
import { HostAssetTargets } from './types';

describe('createDiscoveredHostAssetTargetEntity', () => {
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
      expect(
        createDiscoveredHostAssetTargetEntity(host),
      ).toMatchGraphObjectSchema({
        _class: ['Host'],
        schema: {
          properties: {
            _type: { const: 'discovered_host' },
            qualysAssetId: { type: 'number' },
            qualysQwebHostId: { type: 'number' },
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
    expect(
      createDiscoveredHostAssetTargetEntity(hosts[0]),
    ).toMatchGraphObjectSchema({
      _class: ['Host'],
      schema: {
        required: [
          'hostname',
          'os',
          'platform',
          'qualysAssetId',
          'qualysCreatedOn',
          'scannedBy',
          'lastScannedOn',
          'name',
          'displayName',
          'tags',
        ],
      },
    });
  });

  test('fqdn lowercased', () => {
    const host = hosts[0];
    expect(
      createDiscoveredHostAssetTargetEntity({
        ...host,
        dnsHostName: 'SOMETHING.com',
      }),
    ).toMatchObject({
      fqdn: 'something.com',
    });
  });

  test('tags', () => {
    expect(createDiscoveredHostAssetTargetEntity(hosts[0])).toMatchObject({
      tags: ['Cloud Agent'],
    });
  });
});

describe('createEC2HostAssetTargetEntity', () => {
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
      const arn = getEC2HostAssetArn(host);
      expect(createEC2HostAssetTargetEntity(host)).toMatchGraphObjectSchema({
        _class: ['Host'],
        schema: {
          properties: {
            _key: { const: arn },
            _type: { const: 'aws_instance' },
            accountId: { type: 'string' },
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
    expect(createEC2HostAssetTargetEntity(hosts[0])).toMatchGraphObjectSchema({
      _class: ['Host'],
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
    expect(createEC2HostAssetTargetEntity(host)).toMatchObject({
      state: 'stopped',
    });
  });

  test('tags', () => {
    const host = hosts[1];
    expect(createEC2HostAssetTargetEntity(host)).toMatchObject({
      tags: ['Cloud Agent'],
    });
  });

  test('boolean ec2 tags', () => {
    const host = hosts[1];
    expect(
      createEC2HostAssetTargetEntity({
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
      createEC2HostAssetTargetEntity({
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

describe('createGCPHostAssetTargetEntity', () => {
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
          'gcp-host-assets.xml',
        ),
      )
      .toString('utf8');

    const hostList = xmlParser.parse(hostAssetsXml) as ListHostAssetsResponse;
    hosts = toArray(hostList.ServiceResponse?.data?.HostAsset);
  });

  test('properties transferred', () => {
    for (const host of hosts) {
      const selfLink = getGCPHostAssetSelfLink(host);
      expect(createGCPHostAssetTargetEntity(host)).toMatchGraphObjectSchema({
        _class: ['Host'],
        schema: {
          properties: {
            _key: { const: selfLink },
            _type: { const: 'google_compute_instance' },
            projectId: { type: 'string' },
            state: { type: 'string' },
            instanceId: { type: 'number' },
            qualysFirstDiscoveredOn: { type: 'number' },
            qualysLastUpdatedOn: { type: 'number' },
            zone: { type: 'string' },
            hostname: { type: 'string' },
            machineType: { type: 'string' },
            imageId: { type: 'string' },
            network: { type: 'string' },
            macAddress: { type: 'string' },
            publicIpAddress: { type: 'string' },
            privateIpAddress: { type: 'string' },
          },
        },
      });
    }
  });

  test('required properties', () => {
    expect(createGCPHostAssetTargetEntity(hosts[0])).toMatchGraphObjectSchema({
      _class: ['Host'],
      schema: {
        required: [
          'qualysFirstDiscoveredOn',
          'qualysLastUpdatedOn',
          'projectId',
          'state',
          'instanceId',
          'zone',
          'hostname',
          'machineType',
          'network',
          'macAddress',
          'imageId',
          'privateIpAddress',
          'publicIpAddress',
        ],
      },
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
        const hostTargets: HostAssetTargets = {
          fqdn: 'some.host.domain',
          ec2InstanceArn: 'arn:aws:ec2:us-east-1a:1234:instance/abc',
          awsAccountId: '1234',
        };
        expect(
          createHostFindingEntity({
            key: 'finding-key',
            host: detectionHost,
            detection: hostDetection,
            detectionResults: undefined,
            hostAssetTargets: hostTargets,
            desc: {},
          }),
        ).toMatchGraphObjectSchema({
          _class: ['Finding'],
          schema: {
            properties: {
              id: {
                const: 'finding-key',
              },
              hostId: {
                type: 'number',
              },
              fqdn: {
                const: 'some.host.domain',
              },
              ec2InstanceArn: {
                const: 'arn:aws:ec2:us-east-1a:1234:instance/abc',
              },
              awsAccountId: {
                const: '1234',
              },
            },
            required: ['id'],
          },
        });
      }
    }
  });
});

describe('getHostAssetTags older XML', () => {
  function hostFromXml(xml: string): HostAsset {
    return xmlParser.parse(xml);
  }

  test('one tag', () => {
    expect(
      getHostAssetTags(
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
      getHostAssetTags(
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
    expect(getHostAssetTags(hostFromXml(`<tags></tags>`))).toEqual([]);
  });

  test('empty tag data', () => {
    expect(
      getHostAssetTags(
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
      getHostAssetTags(
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

describe('getHostAssetTags api-v2 XML', () => {
  function hostFromXml(xml: string): HostAsset {
    return xmlParser.parse(xml);
  }

  test('one tag', () => {
    expect(
      getHostAssetTags(
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
      getHostAssetTags(
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
    expect(getHostAssetTags(hostFromXml(`<tags><list/></tags>`))).toEqual([]);
  });

  test('no tags', () => {
    expect(getHostAssetTags(hostFromXml(``))).toEqual([]);
  });

  test('no tags list', () => {
    expect(getHostAssetTags(hostFromXml(`<tags></tags>`))).toEqual([]);
  });

  test('empty tag data', () => {
    expect(
      getHostAssetTags(
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
      getHostAssetTags(
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

describe('getEC2HostAssetTags', () => {
  function hostFromXml(xml: string): HostAsset {
    return xmlParser.parse(xml);
  }

  test('one tag', () => {
    expect(
      getEC2HostAssetTags(
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
      getEC2HostAssetTags(
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
      getEC2HostAssetTags(hostFromXml(`<sourceInfo><list/></sourceInfo>`)),
    ).toEqual([]);
  });

  test('no ec2InstanceTags', () => {
    expect(
      getEC2HostAssetTags(
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
      getEC2HostAssetTags(
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
    expect(getEC2HostAssetTags(hostFromXml(``))).toEqual([]);
  });

  test('empty tag data', () => {
    expect(
      getEC2HostAssetTags(
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
      getEC2HostAssetTags(
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

describe('getHostAssetFqdn', () => {
  test('normalizes fqdn', () => {
    expect(getHostAssetFqdn({ dnsHostName: 'THIS.IS.MY.HOST' })).toEqual(
      'this.is.my.host',
    );
    expect(getHostAssetFqdn({ dnsHostName: '' })).toEqual(undefined);
    expect(getHostAssetFqdn({ dnsHostName: {} as any })).toEqual(undefined);
    expect(getHostAssetFqdn({ dnsHostName: undefined })).toEqual(undefined);
    expect(getHostAssetFqdn({ fqdn: 'THIS.IS.MY.HOST' })).toEqual(
      'this.is.my.host',
    );
    expect(getHostAssetFqdn({ fqdn: '' })).toEqual(undefined);
    expect(getHostAssetFqdn({ fqdn: {} as any })).toEqual(undefined);
    expect(getHostAssetFqdn({ fqdn: undefined })).toEqual(undefined);
  });

  test('uses dnsHostName over fqdn', () => {
    expect(getHostAssetFqdn({ dnsHostName: 'bobby', fqdn: 'bob' })).toEqual(
      'bobby',
    );
    expect(getHostAssetFqdn({ dnsHostName: '', fqdn: 'bob' })).toEqual('bob');
    expect(getHostAssetFqdn({ dnsHostName: {} as any, fqdn: 'bob' })).toEqual(
      'bob',
    );
    expect(getHostAssetFqdn({ dnsHostName: undefined, fqdn: 'bob' })).toEqual(
      'bob',
    );
  });

  test('normalizes with toLowerCase', () => {
    expect(getHostAssetFqdn({ fqdn: 'THIS.IS.MY.HOST' })).toEqual(
      'this.is.my.host',
    );
    expect(getHostAssetFqdn({ fqdn: undefined })).toEqual(undefined);
  });
});

describe('getHostAssetDetails', () => {
  test('non-string os', () => {
    // https://qualysapi.qualys.com/qps/xsd/2.0/am/hostasset.xsd says it should
    // be a string, but we received `os.toLowerCase is not a function` in
    // production 🤷🏼‍♂️
    expect(getHostAssetDetails({ os: {} })).toMatchObject({
      os: undefined,
    });
  });

  test('use getHostAssetFqdn', () => {
    expect(
      getHostAssetDetails({ dnsHostName: 'THIS.IS.MY.HOST' }),
    ).toMatchObject({
      fqdn: 'this.is.my.host',
    });
  });
});

describe('getHostAssetTargets', () => {
  test('uses getHostAssetFqdn', () => {
    expect(
      getHostAssetTargets({ dnsHostName: 'bobby', fqdn: 'bob' }),
    ).toMatchObject({
      fqdn: 'bobby',
    });
  });
});

describe('#getEC2HostAccountId', () => {
  test('should return undefined if `Ec2AssetSourceSimple` property not found on host asset', () => {
    const hostAsset: HostAsset = {
      sourceInfo: {
        list: {
          // This property is intentionally missing
          // Ec2AssetSourceSimple: {},
        },
      },
    };

    expect(getEC2HostAccountId(hostAsset)).toEqual(undefined);
  });

  test('should return undefined if EC2 `accountId` property not found on `Ec2AssetSourceSimple`', () => {
    const hostAsset: HostAsset = {
      sourceInfo: {
        list: {
          Ec2AssetSourceSimple: {},
        },
      },
    };

    expect(getEC2HostAccountId(hostAsset)).toEqual(undefined);
  });

  test('should return `accountId` as type `string` if EC2 `accountId` property found on `Ec2AssetSourceSimple` and `accountId` is type `number`', () => {
    const hostAsset: HostAsset = {
      sourceInfo: {
        list: {
          Ec2AssetSourceSimple: {
            accountId: 123456789123,
          },
        },
      },
    };

    expect(getEC2HostAccountId(hostAsset)).toEqual('123456789123');
  });

  test('should return `accountId` as type `string` if EC2 `accountId` property found on `Ec2AssetSourceSimple` and `accountId` is type `string`', () => {
    const hostAsset: HostAsset = {
      sourceInfo: {
        list: {
          Ec2AssetSourceSimple: {
            accountId: ('123456789123' as unknown) as number,
          },
        },
      },
    };

    expect(getEC2HostAccountId(hostAsset)).toEqual('123456789123');
  });
  test('should pad EC2 instance account ID with leading 0s', () => {
    const hostAsset: HostAsset = {
      sourceInfo: {
        list: {
          Ec2AssetSourceSimple: {
            accountId: 123456789,
          },
        },
      },
    };

    expect(getEC2HostAccountId(hostAsset)).toEqual('000123456789');
  });
});
