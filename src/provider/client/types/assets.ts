import { AssetHostId } from '../';
import { QWebHostId } from './index';
import { ServiceResponseBody } from './qps';
import { ISODateString, PossibleArray } from './util';

// https://qualysapi.qualys.com/qps/xsd/2.0/am/hostasset.xsd

export type SearchHostAssetResponse = ServiceResponseBody<Data>;
export type ListHostAssetsResponse = ServiceResponseBody<Data>;

export type Data = {
  HostAsset?: PossibleArray<HostAsset>;
};

export type HostAsset = {
  id?: AssetHostId;
  name?: string;
  created?: ISODateString;
  modified?: ISODateString;
  type?: string;
  tags?: HostAssetTags;
  sourceInfo?: SourceInfo;
  qwebHostId?: QWebHostId;
  lastComplianceScan?: ISODateString;
  lastSystemBoot?: ISODateString;
  lastLoggedOnUser?: string;

  /**
   * Customers have provided evidence this may exist on results. The schema
   * indicates there is a complex type of `HostAssetInterface` which does
   * include this property, but there is no indication in the schema that the
   * `HostAsset` complex type extends it.
   */
  hostname?: string;

  /**
   * Very possible this is an empty string, ''. Use `dnsHostName` when possible,
   * handle ''.
   */
  fqdn?: string;

  /**
   * Documented as string, but incoming value may not be!
   */
  os?: any;

  /**
   * Expected to be the combination of `hostname.domain`.
   */
  dnsHostName?: string;

  agentInfo?: AgentInfo;
  networkGuid?: string;
  address?: string;
  trackingMethod?: string;
  manufacturer?: string;
  model?: string;
  totalMemory?: number;
  timezone?: string;
  biosDescription?: string;
  openPort?: OpenPort;
  processor?: Processor;
  volume?: Volume;
  account?: Account;
  networkInterface?: NetworkInterface;
  isDockerHost?: boolean;
  lastVulnScan?: ISODateString;
  software?: Software;
  vuln?: Vuln;
};

export type Account = {
  list?: AccountList;
};

export type AccountList = {
  HostAssetAccount?: PossibleArray<HostAssetAccount>;
};

export type HostAssetAccount = {
  username?: string;
};

export type AgentInfo = {
  agentVersion?: string;
  agentId?: string;
  status?: string;
  lastCheckedIn?: ISODateString;
  connectedFrom?: string;
  chirpStatus?: string;
  platform?: string;
  activatedModule?: string;
  manifestVersion?: ManifestVersion;
  agentConfiguration?: AgentConfiguration;
  activationKey?: ActivationKey;
};

export type ActivationKey = {
  activationId?: string;
  title?: string;
};

export type AgentConfiguration = {
  id?: number;
  name?: string;
};

export type ManifestVersion = {
  pc?: string;
  vm?: string;
};

export type NetworkInterface = {
  list?: NetworkInterfaceList;
};

export type NetworkInterfaceList = {
  HostAssetInterface?: PossibleArray<HostAssetInterfaceElement>;
};

export type HostAssetInterfaceElement = {
  hostname?: string;
  interfaceName?: string;
  macAddress?: string;
  type?: string;
  address?: string;
  gatewayAddress?: string;
};

export type OpenPort = {
  list?: OpenPortList;
};

export type OpenPortList = {
  HostAssetOpenPort?: PossibleArray<HostAssetOpenPort>;
};

export type HostAssetOpenPort = {
  port?: number;
  protocol?: Protocol;
};

export type Protocol = 'TCP' | 'UDP' | string;

export type Processor = {
  list?: ProcessorList;
};

export type ProcessorList = {
  HostAssetProcessor?: PossibleArray<HostAssetProcessorElement>;
};

export type HostAssetProcessorElement = {
  name?: string;
  speed?: number;
};

export type Software = {
  list?: SoftwareList;
};

export type SoftwareList = {
  HostAssetSoftware?: PossibleArray<HostAssetSoftware>;
};

export type HostAssetSoftware = {
  name?: string;
  version?: number | string;
};

export type SourceInfo = {
  list?: SourceInfoList;
};

export type SourceInfoList = {
  Ec2AssetSourceSimple?: Ec2AssetSourceSimple;
  GcpAssetSourceSimple?: GcpAssetSourceSimple;
  AssetSource?: string;
};

export type Ec2AssetSourceSimple = {
  assetId?: number;
  type?: string;
  firstDiscovered?: ISODateString;
  lastUpdated?: ISODateString;
  ec2InstanceTags?: EC2InstanceTags;
  reservationId?: string;
  availabilityZone?: string;
  privateDnsName?: string;
  publicDnsName?: string;
  localHostname?: string;
  instanceId?: string;
  instanceType?: string;
  instanceState?: string;
  groupName?: string;
  accountId?: number;
  subnetId?: string;
  vpcId?: string;
  region?: string;
  zone?: string;
  imageId?: string;
  publicIpAddress?: string;
  privateIpAddress?: string;
  macAddress?: string;
};

export type EC2InstanceTags = {
  tags?: EC2InstanceTagsList;
};

export type EC2InstanceTagsList = {
  list?: EC2Tags;
};

export type EC2Tags = {
  EC2Tags?: PossibleArray<EC2Tag>;
};

export type EC2Tag = { key: string; value: string | number | boolean };

export type GcpAssetSourceSimple = {
  type?: string;
  assetId?: number;
  firstDiscovered?: ISODateString;
  lastUpdated?: ISODateString;
  instanceId?: number;
  hostname?: string;
  machineType: string;
  imageId: string;
  zone?: string;
  projectIdNo?: number;
  projectId?: string;
  state?: string;
  network?: string;
  macAddress?: string;
  publicIpAddress?: string;
  privateIpAddress?: string;
  gcpInstanceTags?: GCPInstanceTags;
};

export type GCPInstanceTags = {
  tags?: GCPInstanceTagsList;
};

export type GCPInstanceTagsList = {
  list?: GCPTags;
};

export type GCPTags = {
  GCPTags?: PossibleArray<GCPTag>;
};

export type GCPTag = { key: string; value: string | number | boolean };

export type HostAssetTags = {
  list?: TagsList;
  TAG?: PossibleArray<TAG>;
};

export type TagsList = {
  TagSimple?: PossibleArray<TagSimple>;
};

export type TagSimple = {
  id: number;
  name: string;
};

export type TAG = {
  TAG_ID: number;
  NAME: string;
};

export type Volume = {
  list?: VolumeList;
};

export type VolumeList = {
  HostAssetVolume?: PossibleArray<HostAssetVolume>;
};

export type HostAssetVolume = {
  name?: string;
  size?: number;
  free?: number;
};

export type Vuln = {
  list?: VulnList;
};

export type VulnList = {
  HostAssetVuln?: PossibleArray<HostAssetVuln>;
};

export type HostAssetVuln = {
  qid?: number;
  hostInstanceVulnId?: number;
  firstFound?: ISODateString;
  lastFound?: ISODateString;
};
