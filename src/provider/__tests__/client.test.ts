import fs from 'fs';
import path from 'path';

import { Recording } from '@jupiterone/integration-sdk-testing';

import { config } from '../../../test/config';
import { setupQualysRecording } from '../../../test/recording';
import { DetectionHost, QualysAPIClient, WebApp } from '../client';

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

describe('verifyAuthentication', () => {
  test('inaccessible', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'verifyAuthenticationInaccesible',
      options: { recordFailedRequests: true },
    });

    const client = new QualysAPIClient({
      config: { ...config, qualysUsername: 'testing-failure' },
    });

    await expect(client.verifyAuthentication()).rejects.toThrow(
      'Provider authentication failed at /api/2.0/fo/activity_log/: 401 Unauthorized',
    );
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

    const webApps: WebApp[] = [];
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

    const webApps: WebApp[] = [];
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

describe('fetchHostIds', () => {
  test('none', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'fetchHostIdsNone',
    });

    await expect(createClient().fetchHostIds()).resolves.toEqual([]);
  });

  test('some', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'fetchHostIds',
    });

    const hostId = '107800671';
    await expect(createClient().fetchHostIds()).resolves.toEqual([hostId]);
  });
});

describe('iterateHostDetections', () => {
  test('none', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetectionsNone',
    });

    const hosts: DetectionHost[] = [];

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

    const hosts: DetectionHost[] = [];

    await createClient().iterateHostDetections(
      ['123'],
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

    await expect(
      createClient().iterateHostDetections(['abc123'], async (_) => {
        // noop
      }),
    ).rejects.toThrow(/Bad Request/);
  });

  test('some', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'iterateHostDetections',
    });

    const client = createClient();
    const hostIds = await client.fetchHostIds();

    const hosts: DetectionHost[] = [];

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

    const requests = [/%2C498%2C499$/, /ids=500%2C501$/].reverse();

    recording.server.any().intercept((req, res) => {
      const expectedBody = requests.pop();
      if (!expectedBody) throw 'no more requests expected';
      expect(req.method).toBe('POST');
      expect(req.body).toMatch(expectedBody);
      res.status(200).type('application/xml').send(detectionsXml);
    });

    const hosts: DetectionHost[] = [];
    await createClient().iterateHostDetections(
      [...Array(502)].map((_, i) => String(i)),
      ({ host, detections }) => {
        hosts.push(host);
      },
    );

    expect(hosts.length).toBe(2);
  });
});

describe('executeAPIRequest', () => {
  test('waits towait-sec on 409 response', async () => {
    recording = setupQualysRecording({
      directory: __dirname,
      name: 'executeAPIRequest409',
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
        res.status(409).setHeaders({
          'x-ratelimit-remaining': String(0),
          'x-ratelimit-towait-sec': String(toWaitSec),
        });
      });

    await createClient().verifyAuthentication();

    expect(requestTimes.length).toBe(2);
    expect(requestTimes[1] - requestTimes[0]).toBeGreaterThan(toWaitSec * 1000);
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
});
