type Host = {
  id: number;
};

type HostData = {
  hosts: Host[];
  hostsById: Map<number, Host>;
};

export function generateHostData(numberHosts: number = 100000): HostData {
  const hostData: HostData = {
    hosts: [],
    hostsById: new Map(),
  };

  for (let id = 1; id <= numberHosts; id++) {
    const host = { id };
    hostData.hosts.push(host);
    hostData.hostsById.set(id, host);
  }

  return hostData;
}
