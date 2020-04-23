import { PossibleArray, ISODateString } from '../../types';

export interface ListHostAssetsReply {
  ServiceResponse?: ServiceResponse;
}

export interface ServiceResponse {
  responseCode?: string;
  count?: number;
  hasMoreRecords?: boolean;
  data?: Data;
}

export interface Data {
  HostAsset?: PossibleArray<HostAsset>;
}

export interface HostAsset {
  id?: number;
  name?: string;
  created?: ISODateString;
  modified?: ISODateString;
  type?: string;
  tags?: HostAssetTags;
  sourceInfo?: SourceInfo;
  qwebHostId?: number;
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
}

export interface Account {
  list?: AccountList;
}

export interface AccountList {
  HostAssetAccount?: PossibleArray<HostAssetAccount>;
}

export interface HostAssetAccount {
  username?: string;
}

export interface AgentInfo {
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
}

export interface ActivationKey {
  activationId?: string;
  title?: string;
}

export interface AgentConfiguration {
  id?: number;
  name?: string;
}

export interface ManifestVersion {
  pc?: string;
  vm?: string;
}

export interface NetworkInterface {
  list?: NetworkInterfaceList;
}

export interface NetworkInterfaceList {
  HostAssetInterface?: PossibleArray<HostAssetInterfaceElement>;
}

export interface HostAssetInterfaceElement {
  hostname?: string;
  interfaceName?: string;
  macAddress?: string;
  type?: string;
  address?: string;
  gatewayAddress?: string;
}

export interface OpenPort {
  list?: OpenPortList;
}

export interface OpenPortList {
  HostAssetOpenPort?: PossibleArray<HostAssetOpenPort>;
}

export interface HostAssetOpenPort {
  port?: number;
  protocol?: Protocol;
}

export type Protocol = 'TCP' | 'UDP' | string;

export interface Processor {
  list?: ProcessorList;
}

export interface ProcessorList {
  HostAssetProcessor?: PossibleArray<HostAssetProcessorElement>;
}

export interface HostAssetProcessorElement {
  name?: string;
  speed?: number;
}

export interface Software {
  list?: SoftwareList;
}

export interface SoftwareList {
  HostAssetSoftware?: PossibleArray<HostAssetSoftware>;
}

export interface HostAssetSoftware {
  name?: string;
  version?: number | string;
}

export interface SourceInfo {
  list?: SourceInfoList;
}

export interface SourceInfoList {
  Ec2AssetSourceSimple?: Ec2AssetSourceSimple;
  AssetSource?: string;
}

export interface Ec2AssetSourceSimple {
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
}

export interface Ec2InstanceTags {
  tags?: Ec2InstanceTagsTags;
}

export interface Ec2InstanceTagsTags {
  list?: string;
}

export interface HostAssetTags {
  list?: TagsList;
}

export interface TagsList {
  TagSimple?: PossibleArray<AgentConfiguration>;
}

export interface Volume {
  list?: VolumeList;
}

export interface VolumeList {
  HostAssetVolume?: PossibleArray<HostAssetVolume>;
}

export interface HostAssetVolume {
  name?: string;
  size?: number;
  free?: number;
}

export interface Vuln {
  list?: VulnList;
}

export interface VulnList {
  HostAssetVuln?: PossibleArray<HostAssetVuln>;
}

export interface HostAssetVuln {
  qid?: number;
  hostInstanceVulnId?: number;
  firstFound?: ISODateString;
  lastFound?: ISODateString;
}
