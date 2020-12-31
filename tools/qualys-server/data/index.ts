import assert from 'assert';

type Host = {
  id: number;
};

type Detection = {
  qid: number;
};

type HostData = {
  hosts: Host[];
  hostsById: Map<number, Host>;
  hostIdRange: {
    start: number;
    end: number;
  };
};

/**
 * Generates on average `numberHosts * 50` detections, assuming an even
 * distribution of `Math.random()`. Host IDs will will start somewhere between 1
 * and median.
 *
 * @param numberHosts number of hosts to generate, default `5000` for about
 * `250000` detections
 */
export function generateHostData(numberHosts: number = 5000): HostData {
  const hosts: Host[] = [];
  const hostsById: Map<number, Host> = new Map();

  const detections = () => {
    const detections: Detection[] = [];
    for (let index = 0; index < Math.round(Math.random() * 100); index++) {
      detections.push({
        qid: 29103 + index,
      });
    }
    return detections;
  };

  const hostStartId = Math.floor((Math.random() * numberHosts) / 2) | 1;
  const hostEndId = hostStartId + numberHosts;

  assert.strictEqual(
    hostEndId - hostStartId,
    numberHosts,
    'Expected a number of host IDs to equal to desired number of hosts',
  );

  for (let hostId = hostStartId; hostId < hostEndId; hostId++) {
    const host = { id: hostId, detections };
    hosts.push(host);
    hostsById.set(hostId, host);
  }

  assert.strictEqual(
    hosts.length,
    numberHosts,
    'Expected number of generated hosts to equal desired number of hosts',
  );

  return {
    hosts,
    hostsById,
    hostIdRange: {
      start: hostStartId,
      end: hostEndId,
    },
  };
}
