type Host = {
  id: number;
};

type Detection = {
  qid: number;
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

  const detections = () => {
    const detections: Detection[] = [];
    for (let index = 0; index < Math.round(Math.random() * 100); index++) {
      detections.push({
        qid: 29103 + index,
      });
    }
    return detections;
  };

  for (let id = 1; id <= numberHosts; id++) {
    const host = { id, detections };
    hostData.hosts.push(host);
    hostData.hostsById.set(id, host);
  }

  return hostData;
}
