import assert from 'assert';

type Host = {
  id: number;
  numDetections: number;
  detections: () => Detection[];
};

type Detection = {
  qid: number;
};

type HostData = {
  numHosts: number;
  numDetections: number;
  hosts: Host[];
  hostsById: Map<number, Host>;
  hostIdRange: {
    start: number;
    end: number;
  };
};

/**
 * Generates number of hosts that represent a response to the hosts scanned
 * since request and ensures that when detections are requested for all hosts,
 * the number of detections desired will be produced.
 *
 * The generated host ID range will always start somewhere in the bottom half of
 * the total number to allow for causing different hosts to be returned with
 * some overlap across invocations using the same `numDesiredHosts`.
 *
 * The number of detections for a specific host will vary across invocations.
 *
 * There are most certainly discrepencies between the way this mock data works
 * and the way that Qualys behaves. One example: this will always produce the
 * same set of a few detections amplified to the `numDesiredDetections`. That
 * is, there will not be much diversity in the detections data. The goal here is
 * to generate load!
 *
 * @param numDesiredHosts `5000`, number of hosts to generate
 * @param numDesiredDetections `100000`, total number of detections to generate
 * across all hosts
 */
export function generateHostData(
  numDesiredHosts: number = 5000,
  numDesiredDetections: number = 100000,
): HostData {
  const hosts: Host[] = [];
  const hostsById: Map<number, Host> = new Map();

  const hostStartId = Math.floor((Math.random() * numDesiredHosts) / 2) | 1;
  const hostEndId = hostStartId + numDesiredHosts;
  assert.strictEqual(
    hostEndId - hostStartId,
    numDesiredHosts,
    `Expected number of host IDs to equal to desired number of hosts: ${hostEndId} - ${hostStartId} != ${numDesiredHosts}`,
  );

  const detectionCounts = generateDetectionCounts(
    numDesiredHosts,
    numDesiredDetections,
  );

  for (
    let hostId = hostStartId, index = 0;
    hostId < hostEndId;
    hostId++, index++
  ) {
    const hostNumDetections = detectionCounts.hostDetections.get(index)!;
    const host = {
      id: hostId,
      numDetections: hostNumDetections,
      detections: () => generateDetections(hostNumDetections),
    };
    hosts.push(host);
    hostsById.set(hostId, host);
  }

  assert.strictEqual(
    hosts.length,
    numDesiredHosts,
    `Expected number of generated hosts to equal desired number of hosts: ${hosts.length} != ${numDesiredHosts}`,
  );
  assert.strictEqual(
    detectionCounts.numDistributedDetections,
    detectionCounts.numDesiredDetections,
    `Expected number of distributed detections to equal desired number of detections: ${detectionCounts.numDistributedDetections} != ${detectionCounts.numDesiredDetections}`,
  );

  return {
    numHosts: numDesiredHosts,
    numDetections: numDesiredDetections,
    hosts,
    hostsById,
    hostIdRange: {
      start: hostStartId,
      end: hostEndId,
    },
  };
}

function generateDetections(numDetections: number): Detection[] {
  const detections: Detection[] = [];
  for (let index = 0; index < numDetections; index++) {
    detections.push({
      qid: 29103 + index,
    });
  }
  return detections;
}

function generateDetectionCounts(
  numHosts: number,
  numDesiredDetections: number,
) {
  const minDetectionsPerHost = 3;

  const hostIndices = Array.from(Array(numHosts).keys());
  const numDetectionsToDistribute =
    numDesiredDetections - numHosts * minDetectionsPerHost;

  let numDistributedDetections = 0;

  const hostDetections = hostIndices.reduce((acc, index) => {
    acc.set(index, minDetectionsPerHost);
    numDistributedDetections += minDetectionsPerHost;
    return acc;
  }, new Map<number, number>());

  const numHostsLargeDetectionCount = Math.floor(numHosts * 0.25);
  const distanceBetweenLargeDetectionCount = Math.floor(
    numHosts / numHostsLargeDetectionCount,
  );

  for (let distributed = 0; distributed < numDetectionsToDistribute; ) {
    const hostIndex = Math.floor(Math.random() * hostIndices.length);

    let detections =
      hostIndex % distanceBetweenLargeDetectionCount === 0
        ? Math.floor(Math.random() * 100)
        : 1;

    // The last one should not put us over the desired count
    if (numDesiredDetections < numDistributedDetections + detections)
      detections = numDesiredDetections - numDistributedDetections;

    const detectionCount = hostDetections.get(hostIndex)! + detections;
    hostDetections.set(hostIndex, detectionCount);

    distributed += detections;
    numDistributedDetections += detections;
  }

  return {
    numHosts,
    numDesiredDetections,
    numDistributedDetections,
    hostDetections,
  };
}
