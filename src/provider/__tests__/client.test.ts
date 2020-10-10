import fs from 'fs';
import path from 'path';

import { Recording } from '@jupiterone/integration-sdk-testing';

import { config } from '../../../test/config';
import { setupQualysRecording } from '../../../test/recording';
import {
  assets,
  ClientDelayedRequestEvent,
  ClientRequestEvent,
  ClientResponseEvent,
  DEFAULT_RATE_LIMIT_CONFIG,
  DEFAULT_RETRY_CONFIG,
  QualysAPIClient,
  STANDARD_RATE_LIMIT_STATE,
  vmpc,
  was,
} from '../client';

jest.setTimeout(1000 * 60 * 1);

const createClient = (): QualysAPIClient => {
  return new QualysAPIClient({
    config,
  });
};

let recording: Recording;

afterEach(async () => {
  if (recording) {
    await recording.stop();
  }
});

describe('events', () => {
  let client: QualysAPIClient;
  const url = 'https://example.com/api/test';

  beforeEach(() => {
    client = new QualysAPIClient({ config });

    recording = setupQualysRecording({
      directory: __dirname,
      name: 'events',
    });
  });

  test('request', async () => {
    recording.server.any().intercept((req, res) => {
      res.sendStatus(200);
    });

    let requestEvent: ClientRequestEvent | undefined;
    client.onRequest((event) => {
      requestEvent = event;
    });

    await client.executeAuthenticatedAPIRequest(url, {});

    expect(requestEvent).toEqual({
      rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
      rateLimitState: STANDARD_RATE_LIMIT_STATE,
      rateLimitedAttempts: 0,
      retryAttempts: 0,
      retryConfig: DEFAULT_RETRY_CONFIG,
      retryable: true,
      totalAttempts: 0,
      url,
    });
  });

  test('response', async () => {
    recording.server.any().intercept((req, res) => {
      res
        .setHeaders({
          'x-ratelimit-limit': String(123),
          'x-ratelimit-remaining': String(99),
          'x-ratelimit-towait-sec': String(2),
          'x-ratelimit-window-sec': String(2400),
          'x-concurrency-limit-limit': String(6),
          'x-concurrency-limit-running': String(3),
        })
        .sendStatus(200);
    });

    let responseEvent: ClientResponseEvent | undefined;
    client.onResponse((event) => {
      responseEvent = event;
    });

    await client.executeAuthenticatedAPIRequest(url, {});

    expect(responseEvent).toEqual({
      rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
      rateLimitState: {
        concurrency: 6,
        concurrencyRunning: 3,
        limit: 123,
        limitRemaining: 99,
        limitWindowSeconds: 2400,
        toWaitSeconds: 2,
      },
      rateLimitedAttempts: 0,
      retryAttempts: 0,
      retryConfig: DEFAULT_RETRY_CONFIG,
      retryable: true,
      totalAttempts: 1,
      url,
      completed: true,
      status: 200,
      statusText: 'OK',
    });
  });

  test('retry', async () => {
    recording.server.any().intercept((req, res) => {
      res.sendStatus(409);
    });

    const requestEvents: ClientRequestEvent[] = [];
    client.onRequest((event) => {
      requestEvents.push(event);
    });

    const responseEvents: ClientResponseEvent[] = [];
    client.onResponse((event) => {
      responseEvents.push(event);
    });

    await expect(
      client.executeAuthenticatedAPIRequest(url, {}),
    ).rejects.toThrow(/Could not complete/);

    expect(requestEvents).toEqual([
      {
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 0,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        totalAttempts: 0,
        url,
      },
      {
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 1,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        totalAttempts: 1,
        url,
      },
      {
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 2,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        totalAttempts: 2,
        url,
      },
      {
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 3,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        totalAttempts: 3,
        url,
      },
      {
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 4,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        totalAttempts: 4,
        url,
      },
    ]);

    expect(responseEvents).toEqual([
      {
        completed: false,
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 1,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        status: 409,
        statusText: 'Conflict',
        totalAttempts: 1,
        url,
      },
      {
        completed: false,
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 2,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        status: 409,
        statusText: 'Conflict',
        totalAttempts: 2,
        url,
      },
      {
        completed: false,
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 3,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        status: 409,
        statusText: 'Conflict',
        totalAttempts: 3,
        url,
      },
      {
        completed: false,
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 4,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        status: 409,
        statusText: 'Conflict',
        totalAttempts: 4,
        url,
      },
      {
        completed: false,
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 5,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        status: 409,
        statusText: 'Conflict',
        totalAttempts: 5,
        url,
      },
    ]);
  });

  test('delay', async () => {
    let requestTimes = 0;
    recording.server.any().intercept((req, res) => {
      requestTimes++;
      if (requestTimes === 1) {
        res
          .setHeaders({
            'x-ratelimit-limit': String(10),
            'x-ratelimit-remaining': String(0),
            'x-ratelimit-towait-sec': String(1),
          })
          .sendStatus(409);
      } else {
        res.sendStatus(200);
      }
    });

    const requestEvents: ClientRequestEvent[] = [];
    client.onRequest((event) => {
      requestEvents.push(event);
    });

    const delayedRequestEvents: ClientDelayedRequestEvent[] = [];
    client.onDelayedRequest((event) => {
      delayedRequestEvents.push(event);
    });

    const responseEvents: ClientResponseEvent[] = [];
    client.onResponse((event) => {
      responseEvents.push(event);
    });

    const startTime = Date.now();
    await client.executeAuthenticatedAPIRequest(url, {});

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(1000);

    expect(requestEvents).toEqual([
      {
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
        rateLimitedAttempts: 0,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        totalAttempts: 0,
        url,
      },
      {
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: {
          ...STANDARD_RATE_LIMIT_STATE,
          limit: 10,
          limitRemaining: 0,
          toWaitSeconds: 1,
        },
        rateLimitedAttempts: 1,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        totalAttempts: 1,
        url,
      },
    ]);

    expect(delayedRequestEvents).toEqual([
      {
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: {
          ...STANDARD_RATE_LIMIT_STATE,
          limit: 10,
          limitRemaining: 0,
          toWaitSeconds: 1,
        },
        rateLimitedAttempts: 1,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        delay: 1000,
        totalAttempts: 1,
        url,
      },
    ]);

    expect(responseEvents).toEqual([
      {
        completed: false,
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: {
          ...STANDARD_RATE_LIMIT_STATE,
          limit: 10,
          limitRemaining: 0,
          toWaitSeconds: 1,
        },
        rateLimitedAttempts: 1,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        status: 409,
        statusText: 'Conflict',
        totalAttempts: 1,
        url,
      },
      {
        completed: true,
        rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
        rateLimitState: {
          ...STANDARD_RATE_LIMIT_STATE,
          limit: 10,
          limitRemaining: 0,
          toWaitSeconds: 1,
        },
        rateLimitedAttempts: 1,
        retryAttempts: 0,
        retryConfig: DEFAULT_RETRY_CONFIG,
        retryable: true,
        status: 200,
        statusText: 'OK',
        totalAttempts: 2,
        url,
      },
    ]);
  });
});

describe('verifyAuthentication', () => {
  test('inaccessible', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'verifyAuthenticationInaccesible',
      options: { recordFailedRequests: true },
    });

    let requestCount = 0;
    recording.server.any().on('request', (_req) => {
      requestCount++;
    });

    const client = new QualysAPIClient({
      config: { ...config, qualysUsername: 'testing-failure' },
    });

    await expect(client.verifyAuthentication()).rejects.toThrow(
      'Provider authentication failed at /api/2.0/fo/activity_log/: 401 Unauthorized',
    );

    expect(requestCount).toBe(1);
  });

  test('accessible', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'verifyAuthentication',
      options: { recordFailedRequests: true },
    });

    await expect(
      createClient().verifyAuthentication(),
    ).resolves.not.toThrowError();
  });
});

describe('fetchPortalInfo', () => {
  test('info', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'fetchPortalInfo',
    });

    await expect(createClient().fetchPortalInfo()).resolves.toMatchObject({
      'Portal-Version': expect.any(Object),
      'QWeb-Version': expect.any(Object),
    });
  });
});

describe('iterateWebApps', () => {
  test('invalid filter value', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateWebAppsInvalidFilterValue',
    });

    await expect(
      createClient().iterateWebApps(
        (_webApp) => {
          // noop
        },
        {
          filters: { isScanned: undefined },
        },
      ),
    ).rejects.toThrow('INVALID_REQUEST');
  });

  test('pagination', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateWebAppsPagination',
    });

    const webApps: was.WebApp[] = [];
    await createClient().iterateWebApps(
      (webApp) => {
        webApps.push(webApp);
      },
      {
        pagination: {
          limit: 1,
        },
      },
    );

    expect(webApps.length).toBeGreaterThan(1);
    webApps.forEach((w) => {
      expect(w.url).toMatch(/^http/);
    });
  });

  test('scanned', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateWebApps',
    });

    const webApps: was.WebApp[] = [];
    await createClient().iterateWebApps(
      (webApp) => {
        webApps.push(webApp);
      },
      {
        filters: {
          isScanned: true,
        },
      },
    );

    expect(webApps.length).toBeGreaterThan(0);
    webApps.forEach((w) => {
      expect(w.url).toMatch(/^http/);
    });
  });
});

describe('fetchScannedWebAppIds', () => {
  test('none', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'fetchScannedWebAppIdsNone',
    });

    await expect(createClient().fetchScannedWebAppIds()).resolves.toEqual([]);
  });

  test('some', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'fetchScannedWebAppIds',
    });

    const webAppId = 81221901;
    await expect(createClient().fetchScannedWebAppIds()).resolves.toEqual([
      webAppId,
    ]);
  });
});

describe('iterateWebAppFindings', () => {
  test('none', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateWebAppFindingsNone',
    });

    const findings: was.WebAppFinding[] = [];

    await createClient().iterateWebAppFindings([], (webapp) => {
      findings.push(webapp);
    });

    expect(findings.length).toBe(0);
  });

  test('unknown webapp id', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateWebAppFindingsUnknownId',
    });

    const findings: was.WebAppFinding[] = [];

    await createClient().iterateWebAppFindings([123], (webapp) => {
      findings.push(webapp);
    });

    expect(findings.length).toBe(0);
  });

  test('bad webapp id', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateWebAppFindingsBadId',
      options: { recordFailedRequests: true },
    });

    await expect(
      createClient().iterateWebAppFindings(
        [('abc123' as unknown) as number],
        async (_) => {
          // noop
        },
      ),
    ).rejects.toThrow(/INVALID_REQUEST/);
  });

  test('some', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateWebAppFindings',
    });

    const client = createClient();
    const webappIds = await client.fetchScannedWebAppIds();

    const findings: was.WebAppFinding[] = [];

    await client.iterateWebAppFindings(webappIds, (webapp) => {
      findings.push(webapp);
    });

    expect(findings.length).toBeGreaterThan(0);
  });
});

describe('fetchScannedHostIds', () => {
  test('none', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'fetchScannedHostIdsNone',
    });

    await expect(createClient().fetchScannedHostIds()).resolves.toEqual([]);
  });

  test('some', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'fetchScannedHostIds',
    });

    const hostId = 107800671;
    await expect(createClient().fetchScannedHostIds()).resolves.toEqual([
      hostId,
    ]);
  });
});

describe('iterateScannedHostIds', () => {
  const allHostIds = [...Array(23).keys()];

  // https://www.qualys.com/docs/qualys-api-vmpc-user-guide.pdf
  // Those docs only indicate this kind of response.
  const hostList = (ids: number[]): string =>
    `<HOST_LIST>${ids
      .map((e) => `<HOST><ID>${e}</ID></HOST>`)
      .join('')}</HOST_LIST>`;

  // https://github.com/QualysAPI/Qualys-API-Doc-Center/blob/master/Host%20List%20Detection%20API%20samples/Multithreading/multi_thread_hd.py
  // That prescribed approach indicates this kind of response, and it is the
  // recorded response structure when the orginal fetchScannedHostIds was
  // written and recorded.
  const idSet = (ids: number[]): string =>
    `<ID_SET>${ids.map((e) => `<ID>${e}</ID>`).join('')}</ID_SET>`;

  const paginateWarning = (limit: number, nextId: number): string => `<WARNING>
          <CODE>1980</CODE>
          <TEXT>1000 record limit exceeded. Use URL to get next batch of results.</TEXT>
          <URL><![CDATA[https://qualysapi.qualys.com/api/2.0/fo/asset/host/?action=list&truncation_limit=${limit}&id_min=${nextId}]]></URL>
        </WARNING>`;

  const hostListOutput = (
    listFunction: (ids: number[]) => string,
    ids: number[],
    limit: number,
    nextId: number,
  ): string => `
      <HOST_LIST_OUTPUT>
        <RESPONSE>
          ${listFunction(ids)}
          ${
            nextId < allHostIds.length - 1 ? paginateWarning(limit, nextId) : ''
          }
        </RESPONSE>
      </HOST_LIST_OUTPUT>
      `;

  test('mocked HOST_LIST response', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateScannedHostIdsHostList',
    });

    recording.server.any().intercept((req, res) => {
      const limit = Number(req.query['truncation_limit']);
      const idMin = Number(req.query['id_min']) || 0;
      const ids = allHostIds.slice(idMin, idMin + limit);
      const nextId = idMin + limit;
      res.status(200).send(hostListOutput(hostList, ids, limit, nextId));
    });

    const hostIds: number[] = [];
    await createClient().iterateScannedHostIds(
      (ids) => {
        ids.forEach((e) => hostIds.push(e));
      },
      { pageSize: 10 },
    );

    expect(hostIds).toEqual(allHostIds);
  });

  test('mocked ID_SET response', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateScannedHostIdsIdSet',
    });

    recording.server.any().intercept((req, res) => {
      const limit = Number(req.query['truncation_limit']);
      const idMin = Number(req.query['id_min']) || 0;
      const ids = allHostIds.slice(idMin, idMin + limit);
      const nextId = idMin + limit;
      res.status(200).send(hostListOutput(idSet, ids, limit, nextId));
    });

    const hostIds: number[] = [];
    await createClient().iterateScannedHostIds(
      (ids) => {
        ids.forEach((e) => hostIds.push(e));
      },
      { pageSize: 10 },
    );

    expect(hostIds).toEqual(allHostIds);
  });
});

describe('iterateHostDetails', () => {
  test('none', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetailsNone',
    });

    const hosts: assets.HostAsset[] = [];

    await createClient().iterateHostDetails([], (host) => {
      hosts.push(host);
    });

    expect(hosts.length).toBe(0);
  });

  test('unknown host id', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetailsUnknownId',
    });

    const hosts: assets.HostAsset[] = [];

    await createClient().iterateHostDetails([123], (host) => {
      hosts.push(host);
    });

    expect(hosts.length).toBe(0);
  });

  test('bad host id', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetailsBadId',
      options: { recordFailedRequests: true },
    });

    await expect(
      createClient().iterateHostDetails(
        [('abc123' as unknown) as number],
        async (_) => {
          // noop
        },
      ),
    ).rejects.toThrow(/INVALID_REQUEST/);
  });

  test('some', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetails',
    });

    const client = createClient();
    const hostIds = await client.fetchScannedHostIds();

    const hosts: assets.HostAsset[] = [];

    await client.iterateHostDetails(hostIds, (host) => {
      hosts.push(host);
    });

    expect(hosts.length).toBeGreaterThan(0);
  });
});

describe('fetchHostDetails', () => {
  test('some', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'fetchHostDetails',
    });

    const client = createClient();
    const hostIds = await client.fetchScannedHostIds();
    expect(hostIds.length).toBeGreaterThan(0);

    const hostDetails = await client.fetchHostDetails(hostIds[0]);
    expect(hostDetails).toMatchObject({
      qwebHostId: hostIds[0],
      sourceInfo: expect.objectContaining({
        list: expect.objectContaining({
          Ec2AssetSourceSimple: expect.any(Object),
        }),
      }),
    });
  });
});

describe('iterateHostDetections', () => {
  test('none', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetectionsNone',
    });

    const hosts: vmpc.DetectionHost[] = [];

    await createClient().iterateHostDetections([], ({ host, detections }) => {
      hosts.push(host);
    });

    expect(hosts.length).toBe(0);
  });

  test('unknown host id', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetectionsUnknownId',
    });

    const hosts: vmpc.DetectionHost[] = [];

    await createClient().iterateHostDetections(
      [123],
      ({ host, detections }) => {
        hosts.push(host);
      },
    );

    expect(hosts.length).toBe(0);
  });

  test('bad host id', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetectionsBadId',
      options: { recordFailedRequests: true },
    });

    let requestCount = 0;
    recording.server.any().on('request', (_req) => {
      requestCount++;
    });

    await expect(
      createClient().iterateHostDetections(
        [('abc123' as unknown) as number],
        async (_) => {
          // noop
        },
      ),
    ).rejects.toThrow(/Bad Request/);

    expect(requestCount).toBe(1);
  });

  test('some', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetections',
    });

    const client = createClient();
    const hostIds = await client.fetchScannedHostIds();

    const hosts: vmpc.DetectionHost[] = [];

    await client.iterateHostDetections(hostIds, ({ host, detections }) => {
      hosts.push(host);
    });

    // TODO: Get some actual vulnerability scans working
    // expect(hosts.length).toBeGreaterThan(0);
  });

  test('some mocked', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetectionsMocked',
    });

    const detectionsXml = fs
      .readFileSync(path.join(__dirname, 'fixtures', 'detections.xml'))
      .toString('utf8');

    const requests = [/%2C298%2C299$/, /ids=300%2C301$/].reverse();

    recording.server.any().intercept((req, res) => {
      const expectedBody = requests.pop();
      if (!expectedBody) throw 'no more requests expected';
      expect(req.method).toBe('POST');
      expect(req.body).toMatch(expectedBody);
      res.status(200).type('application/xml').send(detectionsXml);
    });

    const hosts: vmpc.DetectionHost[] = [];
    await createClient().iterateHostDetections(
      [...Array(302)].map((_, i) => i),
      ({ host, detections }) => {
        hosts.push(host);
      },
    );

    expect(hosts.length).toBe(2);
  });
});

describe('iterateVulnerabilities', () => {
  test('none', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateVulnerabilitiesNone',
    });

    const vulns: vmpc.Vuln[] = [];

    await createClient().iterateVulnerabilities([], (vuln) => {
      vulns.push(vuln);
    });

    expect(vulns.length).toBe(0);
  });

  test('unknown id', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateVulnerabilitiesUnknownId',
      options: { recordFailedRequests: true },
    });

    const vulns: vmpc.Vuln[] = [];

    await createClient().iterateVulnerabilities([123], (vuln) => {
      vulns.push(vuln);
    });

    expect(vulns.length).toBe(0);
  });

  test('bad id', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateVulnerabilitiesBadId',
      options: { recordFailedRequests: true },
    });

    await expect(
      createClient().iterateVulnerabilities(
        [('abc123' as unknown) as number],
        async (_) => {
          // noop
        },
      ),
    ).rejects.toThrow(/Bad Request/);
  });

  test('some', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateVulnerabilities',
    });

    const client = createClient();
    const vulns: vmpc.Vuln[] = [];

    await client.iterateVulnerabilities([316760], (vuln) => {
      vulns.push(vuln);
    });

    expect(vulns.length).toBe(1);
  });
});

// TODO consider aborting if time to next request is over some amount of time
describe('executeAPIRequest', () => {
  const concurrencyLimitXMLBody = `
    <SIMPLE_RETURN>
      <RESPONSE>
      <DATETIME>2017-04-12T14:52:39Z </DATETIME>
      <CODE>1960</CODE>
      <TEXT> This API cannot be run again until 1 currently running API instance has finished.</TEXT>
      <ITEM_LIST>
      <ITEM>
      <KEY>CALLS_TO_FINISH</KEY>
      <VALUE>2</VALUE>
      </ITEM>
      </ITEM_LIST>
      </RESPONSE>
    </SIMPLE_RETURN>`;

  const rateLimitXMLBody = `
    <SIMPLE_RETURN>
      <RESPONSE>
      <DATETIME>2017-04-12T14:52:39Z </DATETIME>
      <CODE>1965</CODE>
      <TEXT> This API cannot be run again for another 23 hours, 57 minutes and 54 seconds.</TEXT>
      <ITEM_LIST>
      <ITEM>
      <KEY>SECONDS_TO_WAIT</KEY>
      <VALUE>68928</VALUE>
      </ITEM>
      </ITEM_LIST>
      </RESPONSE>
    </SIMPLE_RETURN>`;

  test('waits towait-sec on 409 rate limit response', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'executeAPIRequest409rateLimit',
      options: { recordFailedRequests: true },
    });

    const requestTimes: number[] = [];
    recording.server.any().on('request', (_req, _event) => {
      requestTimes.push(Date.now());
    });

    const toWaitSec = 1;
    recording.server
      .any()
      .times(1)
      .intercept((_req, res) => {
        res
          .status(409)
          .setHeaders({
            'x-ratelimit-limit': String(300),
            'x-ratelimit-remaining': String(0),
            'x-ratelimit-towait-sec': String(toWaitSec),
          })
          .send(rateLimitXMLBody);
      });

    await createClient().verifyAuthentication();

    expect(requestTimes.length).toBe(2);
    expect(requestTimes[1] - requestTimes[0]).toBeGreaterThan(toWaitSec * 1000);
  });

  test('waits on 409 concurrency limit response', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'executeAPIRequest409concurrencyLimit',
      options: { recordFailedRequests: true },
    });

    const requestTimes: number[] = [];
    recording.server.any().on('request', (_req, _event) => {
      requestTimes.push(Date.now());
    });

    recording.server.any().intercept((_req, res) => {
      res
        .status(409)
        .setHeaders({
          'x-concurrency-limit-limit': String(2),
          'x-concurrency-limit-running': String(2),
        })
        .send(concurrencyLimitXMLBody);
    });

    const client = new QualysAPIClient({
      config,
      rateLimitConfig: {
        maxAttempts: 2,
        concurrencyDelay: 500,
      },
    });

    await expect(client.verifyAuthentication()).rejects.toThrow(/409 Conflict/);

    expect(requestTimes.length).toBe(2);
    expect(requestTimes[1] - requestTimes[0]).toBeGreaterThan(500);
  });

  test('retries 409 response limited times', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'executeAPIRequest409Limit',
      options: { recordFailedRequests: true },
    });

    const requestTimes: number[] = [];
    recording.server.any().on('request', (_req, _event) => {
      requestTimes.push(Date.now());
    });

    recording.server.any().intercept((_req, res) => {
      res.status(409).setHeaders({
        'x-ratelimit-limit': String(300),
        'x-ratelimit-remaining': String(100),
      });
    });

    const client = new QualysAPIClient({
      config,
      rateLimitConfig: {
        maxAttempts: 2,
      },
    });

    await expect(client.verifyAuthentication()).rejects.toThrowError(/2/);

    expect(requestTimes.length).toBe(2);
  });

  test('throttles at specified reserveLimit', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'executeAPIRequestReserveLimit',
      options: { recordFailedRequests: true },
    });

    let limitRemaining = 10;

    recording.server.any().intercept((_req, res) => {
      limitRemaining--;
      res.status(201).setHeaders({
        'x-ratelimit-limit': String(10),
        'x-ratelimit-remaining': String(limitRemaining),
      });
    });

    const client = new QualysAPIClient({
      config,
      rateLimitConfig: {
        reserveLimit: 8,
        cooldownPeriod: 1000,
      },
    });

    const startTime = Date.now();

    await client.verifyAuthentication();
    await client.verifyAuthentication();
    await client.verifyAuthentication();

    expect(Date.now() - startTime).toBeGreaterThanOrEqual(1000);
  });

  test('retries unexpected errors', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'executeAPIRequestRetryUnexpected',
      options: { recordFailedRequests: true },
    });

    let requestCount = 0;
    recording.server.any().intercept((_req, res) => {
      requestCount++;
      res.status(500);
    });

    const client = new QualysAPIClient({
      config,
      retryConfig: {
        maxAttempts: 2,
      },
    });

    await expect(client.verifyAuthentication()).rejects.toThrow(
      /500 Internal Server Error/,
    );

    expect(requestCount).toBe(2);
  });

  test('does not retry bad request', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'executeAPIRequestBadRequest',
      options: { recordFailedRequests: true },
    });

    let requestCount = 0;
    recording.server.any().intercept((_req, res) => {
      requestCount++;
      res.status(400);
    });

    const client = new QualysAPIClient({
      config,
      retryConfig: {
        maxAttempts: 2,
      },
    });

    await expect(client.verifyAuthentication()).rejects.toThrow(
      /400 Bad Request/,
    );

    expect(requestCount).toBe(1);
  });

  test('does not retry authentication error', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'executeAPIRequestUnauthRequest',
      options: { recordFailedRequests: true },
    });

    let requestCount = 0;
    recording.server.any().intercept((_req, res) => {
      requestCount++;
      res.status(401);
    });

    const client = new QualysAPIClient({
      config,
      retryConfig: {
        maxAttempts: 2,
      },
    });

    await expect(client.verifyAuthentication()).rejects.toThrow(
      /401 Unauthorized/,
    );

    expect(requestCount).toBe(1);
  });
});
