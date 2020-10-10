import { QWebHostId } from './index';
import { ISODateString, PossibleArray } from './util';

export type SearchHostAssetResponse = {
  ServiceResponse?: ServiceResponse;
};

export type ListHostAssetsResponse = {
  ServiceResponse?: ServiceResponse;
};

export type ServiceResponse = {
  responseCode?: string;
  count?: number;
  hasMoreRecords?: boolean;
  data?: Data;
};

export type Data = {
  HostAsset?: PossibleArray<HostAsset>;
};

export type HostAsset = {
  id?: number;
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
  fqdn?: string;
  os?: string;
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
  AssetSource?: string;
};

export type Ec2AssetSourceSimple = {
  assetId?: number;
  type?: string;
  firstDiscovered?: ISODateString;
  lastUpdated?: ISODateString;
  ec2InstanceTags?: Ec2InstanceTags;
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

export type Ec2InstanceTags = {
  tags?: Ec2InstanceTagsTags;
};

export type Ec2InstanceTagsTags = {
  list?: PossibleArray<string>;
};

export type HostAssetTags = {
  list?: TagsList;
};

export type TagsList = {
  TagSimple?: PossibleArray<AgentConfiguration>;
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
