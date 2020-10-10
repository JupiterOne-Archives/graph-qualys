import EventEmitter from 'events';
import xmlParser from 'fast-xml-parser';
import chunk from 'lodash/chunk';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import querystring from 'querystring';
import { URLSearchParams } from 'url';

import {
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
} from '@jupiterone/integration-sdk-core';

import { QualysIntegrationConfig } from '../../types';
import { executeAPIRequest } from './request';
import {
  assets,
  ClientDelayedRequestEvent,
  ClientEvents,
  ClientRequestEvent,
  ClientResponseEvent,
  RateLimitConfig,
  RateLimitState,
  RetryConfig,
  vmpc,
  was,
} from './types';
import { PortalInfo } from './types/portal';
import {
  ListHostDetectionsResponse,
  ListQualysVulnerabilitiesResponse,
} from './types/vmpc';
import { toArray } from './util';
import { buildFilterXml } from './was/util';

export * from './types';

export type ResourceIteratee<T> = (each: T) => Promise<void> | void;

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  noRetry: [400, 401, 403],
};

/**
 * An initial rate limit state for a standard subscription level.
 *
 * @see https://www.qualys.com/docs/qualys-api-limits.pdf for details on
 * subscription level rate limits.
 */
export const STANDARD_RATE_LIMIT_STATE: RateLimitState = {
  limit: 300,
  limitRemaining: 300,
  limitWindowSeconds: 60 * 60,
  toWaitSeconds: 0,
  concurrency: 2,
  concurrencyRunning: 0,
};

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  responseCode: 409,
  maxAttempts: 5,
  reserveLimit: 30,
  cooldownPeriod: 1000,
  concurrencyDelay: 10000,
};

export type QualysAPIClientConfig = {
  config: QualysIntegrationConfig;

  /**
   * Initializes the API client with a `RateLimitConfig`.
   *
   * @see DEFAULT_RATE_LIMIT_CONFIG
   */
  rateLimitConfig?: Partial<RateLimitConfig>;

  /**
   * Initializes the API client with a `RateLimitState`. When not provided, the
   * `STANDARD_RATE_LIMIT_STATE` is used to be conservative. The state will
   * update based on the responses so that a customer with a bigger subscription
   * will get their benefits.
   *
   * @see STANDARD_RATE_LIMIT_STATE
   */
  rateLimitState?: RateLimitState;

  /**
   * Initializes the API client witha `RetryConfig`.
   *
   * @see DEFAULT_RETRY_CONFIG
   */
  retryConfig?: Partial<RetryConfig>;
};

export class QualysAPIClient {
  private events: EventEmitter;

  private config: QualysIntegrationConfig;
  private retryConfig: RetryConfig;
  private rateLimitConfig: RateLimitConfig;

  // NOTE: This is NOT thread safe at this time.
  private rateLimitState: RateLimitState;

  constructor({
    config,
    retryConfig,
    rateLimitConfig,
    rateLimitState,
  }: QualysAPIClientConfig) {
    this.config = config;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.rateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...rateLimitConfig };
    this.rateLimitState = rateLimitState || STANDARD_RATE_LIMIT_STATE;
    this.events = new EventEmitter();
  }

  public onRequest(eventHandler: (event: ClientRequestEvent) => void): void {
    this.events.on(ClientEvents.REQUEST, eventHandler);
  }

  public onDelayedRequest(
    eventHandler: (event: ClientDelayedRequestEvent) => void,
  ): void {
    this.events.on(ClientEvents.DELAYED_REQUEST, eventHandler);
  }

  public onResponse(eventHandler: (event: ClientResponseEvent) => void): void {
    this.events.on(ClientEvents.RESPONSE, eventHandler);
  }

  public async verifyAuthentication(): Promise<void> {
    const endpoint = '/api/2.0/fo/activity_log/';

    try {
      await this.executeAuthenticatedAPIRequest(
        this.qualysUrl(endpoint, {
          action: 'list',
          username: this.config.qualysUsername,
          truncation_limit: 1,
        }),
        {
          method: 'GET',
        },
      );
    } catch (err) {
      throw new IntegrationProviderAuthenticationError({
        cause: err,
        endpoint,
        status: err.status,
        statusText: err.statusText,
      });
    }
  }

  public async fetchPortalInfo(): Promise<PortalInfo | undefined> {
    const endpoint = '/qps/rest/portal/version';

    try {
      const response = await this.executeAuthenticatedAPIRequest(
        this.qualysUrl(endpoint, {}),
        {
          method: 'GET',
        },
      );

      const responseText = await response.text();
      return xmlParser.parse(responseText).ServiceResponse?.data as PortalInfo;
    } catch (err) {
      return undefined;
    }
  }

  /**
   * Iterate web applications. Details are minimal, it is necessary to request
   * details in a separate call.
   *
   * @see fetchScannedWebAppIds to simply obtain the scanned web app ID values
   */
  public async iterateWebApps(
    iteratee: ResourceIteratee<was.WebApp>,
    options?: {
      filters?: was.ListWebAppsFilters;
      pagination?: was.ListWebAppsPagination;
    },
  ): Promise<void> {
    const endpoint = '/qps/rest/3.0/search/was/webapp';

    const filterXml = options?.filters ? buildFilterXml(options.filters) : '';

    const body = ({ limit, offset }: { limit: number; offset: number }) => {
      return `
        <ServiceRequest>
          <preferences>
            <limitResults>${limit}</limitResults>
            <startFromOffset>${offset}</startFromOffset>
          </preferences>
          ${filterXml}
        </ServiceRequest>`;
    };

    // The WAS APIs have no rate limits on them; iterate in smaller batches to
    // keep memory pressure low.
    const limit = options?.pagination?.limit || 100;
    let offset = options?.pagination?.offset || 1;

    let hasMoreRecords = true;
    do {
      const response = await this.executeAuthenticatedAPIRequest(
        this.qualysUrl(endpoint, {}),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml',
          },
          body: body({ limit, offset }),
        },
      );

      const responseText = await response.text();
      const jsonFromXml = xmlParser.parse(
        responseText,
      ) as was.ListWebAppsResponse;

      const responseCode = jsonFromXml.ServiceResponse?.responseCode;
      if (responseCode && responseCode !== 'SUCCESS') {
        throw new IntegrationProviderAPIError({
          cause: new Error(
            `Unexpected responseCode in ServiceResponse: ${responseCode}`,
          ),
          endpoint,
          status: response.status,
          statusText: responseCode,
        });
      }

      for (const webApp of toArray(jsonFromXml.ServiceResponse?.data?.WebApp)) {
        await iteratee(webApp);
      }

      hasMoreRecords = !!jsonFromXml.ServiceResponse?.hasMoreRecords;

      if (hasMoreRecords) {
        offset += limit;
      }
    } while (hasMoreRecords);
  }

  public async fetchScannedWebAppIds(): Promise<number[]> {
    const ids: number[] = [];
    await this.iterateWebApps(
      (webApp) => {
        ids.push(webApp.id!);
      },
      { filters: { isScanned: true } },
    );
    return ids;
  }

  /**
   * Iterate web application vulnerability findings.
   */
  public async iterateWebAppFindings(
    webAppIds: number[],
    iteratee: ResourceIteratee<was.WebAppFinding>,
  ): Promise<void> {
    const fetchWebAppFindings = async (ids: number[]) => {
      const endpoint = '/qps/rest/3.0/search/was/finding/';

      const body = `
      <ServiceRequest>
        <preferences>
          <limitResults>${ids.length}</limitResults>
        </preferences>
        <filters>
          <Criteria field="webApp.id" operator="IN">${ids.join(',')}</Criteria>
        </filters>
      </ServiceRequest>`;

      const response = await this.executeAuthenticatedAPIRequest(
        this.qualysUrl(endpoint, {}),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml',
          },
          body,
        },
      );

      const responseText = await response.text();
      const jsonFromXml = xmlParser.parse(
        responseText,
      ) as was.ListWebAppFindingsResponse;

      const responseCode = jsonFromXml.ServiceResponse?.responseCode;
      if (responseCode && responseCode !== 'SUCCESS') {
        throw new IntegrationProviderAPIError({
          cause: new Error(
            `Unexpected responseCode in ServiceResponse: ${responseCode}`,
          ),
          endpoint,
          status: response.status,
          statusText: responseCode,
        });
      }

      return toArray(jsonFromXml.ServiceResponse?.data?.Finding);
    };

    for (const ids of chunk(webAppIds, 300)) {
      const findings = await fetchWebAppFindings(ids);
      for (const finding of findings) {
        await iteratee(finding);
      }
    }
  }

  /**
   * Answers the complete set of scanned host IDs provided by the Qualys VMDR
   * module. This does not include hosts that have never been scanned.
   *
   * There are three IDs in Qualys. The IDs returned by this API are the VM
   * module "QWEB" host IDs.
   *
   * @see https://qualys-secure.force.com/discussions/s/article/000006216 to
   * understand the difference.
   *
   * Fetches all IDs in a single request. This is documented by Qualys as a best
   * practice for an implementation that will parallelize ingestion of other
   * data for the hosts.
   *
   * @see
   * https://github.com/QualysAPI/Qualys-API-Doc-Center/blob/master/Host%20List%20Detection%20API%20samples/Multithreading/multi_thread_hd.py
   * for recommended approach to fetching set of hosts to process.
   */
  public async fetchScannedHostIds(): Promise<number[]> {
    const endpoint = '/api/2.0/fo/asset/host/';

    const response = await this.executeAuthenticatedAPIRequest(
      this.qualysUrl(endpoint, {
        action: 'list',
        details: 'None',
        truncation_limit: 0,
      }),
      {
        method: 'GET',
      },
    );

    const responseText = await response.text();
    const jsonFromXml = xmlParser.parse(responseText);
    return toArray(jsonFromXml.HOST_LIST_OUTPUT?.RESPONSE?.ID_SET).map(
      (e) => e.ID,
    );
  }

  /**
   * Iterate details of hosts known to the Asset Manager.
   *
   * There are currently no [rate
   * limits](https://www.qualys.com/docs/qualys-api-limits.pdf) on the Asset
   * Manager APIs.
   *
   * @param hostIds a set of identified QWEB host IDs
   */
  public async iterateHostDetails(
    hostIds: number[],
    iteratee: ResourceIteratee<assets.HostAsset>,
  ): Promise<void> {
    const fetchHostDetails = async (ids: number[]) => {
      const endpoint = '/qps/rest/2.0/search/am/hostasset';

      const body = `
      <ServiceRequest>
        <preferences>
          <limitResults>${ids.length}</limitResults>
        </preferences>
        <filters>
          <Criteria field="qwebHostId" operator="IN">${ids.join(',')}</Criteria>
        </filters>
      </ServiceRequest>`;

      const response = await this.executeAuthenticatedAPIRequest(
        this.qualysUrl(endpoint, {}),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml',
          },
          body,
        },
      );

      const responseText = await response.text();
      const jsonFromXml = xmlParser.parse(
        responseText,
      ) as assets.SearchHostAssetResponse;

      const responseCode = jsonFromXml.ServiceResponse?.responseCode;
      if (responseCode && responseCode !== 'SUCCESS') {
        throw new IntegrationProviderAPIError({
          cause: new Error(
            `Unexpected responseCode in ServiceResponse: ${responseCode}`,
          ),
          endpoint,
          status: response.status,
          statusText: responseCode,
        });
      }

      return toArray(jsonFromXml.ServiceResponse?.data?.HostAsset);
    };

    for (const ids of chunk(hostIds, 100)) {
      const hosts = await fetchHostDetails(ids);
      for (const host of hosts) {
        await iteratee(host);
      }
    }
  }

  /**
   * Fetch host details from asset manager.
   *
   * @param hostId a QWEB host ID
   */
  public async fetchHostDetails(hostId: number): Promise<assets.HostAsset> {
    const endpoint = '/qps/rest/2.0/search/am/hostasset';

    const body = `
    <ServiceRequest>
      <preferences>
        <limitResults>1</limitResults>
      </preferences>
      <filters>
        <Criteria field="qwebHostId" operator="EQUALS">${hostId}</Criteria>
      </filters>
    </ServiceRequest>`;

    const response = await this.executeAuthenticatedAPIRequest(
      this.qualysUrl(endpoint, {}),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
        },
        body,
      },
    );

    const responseText = await response.text();
    const jsonFromXml = xmlParser.parse(
      responseText,
    ) as assets.SearchHostAssetResponse;

    const responseCode = jsonFromXml.ServiceResponse?.responseCode;
    if (responseCode && responseCode !== 'SUCCESS') {
      throw new IntegrationProviderAPIError({
        cause: new Error(
          `Unexpected responseCode in ServiceResponse: ${responseCode}`,
        ),
        endpoint,
        status: response.status,
        statusText: responseCode,
      });
    }

    return jsonFromXml.ServiceResponse?.data?.HostAsset as assets.HostAsset;
  }

  /**
   * Iterate detected host vulnerabilities.
   *
   * These are not the vulnerabilities themselves, which come from a
   * vulnerability database by QID, but the findings of vulnerabilities for a
   * host.
   *
   * @param hostIds the set of QWEB host IDs to fetch detections
   * @param iteratee receives each host and its detections
   */
  public async iterateHostDetections(
    hostIds: number[],
    iteratee: ResourceIteratee<{
      host: vmpc.DetectionHost;
      detections: vmpc.HostDetection[];
    }>,
  ): Promise<void> {
    const fetchHostDetections = async (ids: number[]) => {
      const endpoint = '/api/2.0/fo/asset/host/vm/detection/';

      const params = new URLSearchParams({
        action: 'list',
        show_tags: '1',
        show_igs: '1',
        output_format: 'XML',
        ids: ids.map(String),
      });

      const response = await this.executeAuthenticatedAPIRequest(
        this.qualysUrl(endpoint),
        { method: 'POST', body: params },
      );

      const responseText = await response.text();
      const jsonFromXml = xmlParser.parse(
        responseText,
      ) as ListHostDetectionsResponse;
      const detectionHosts: vmpc.DetectionHost[] = toArray(
        jsonFromXml.HOST_LIST_VM_DETECTION_OUTPUT?.RESPONSE?.HOST_LIST?.HOST,
      );

      for (const host of detectionHosts) {
        await iteratee({
          host,
          detections: toArray(host.DETECTION_LIST?.DETECTION),
        });
      }
    };

    // Starting simple, sequential requests for pages. Once client supports
    // concurrency, add to queue to allow concurrency control.
    for (const ids of chunk(hostIds, 300)) {
      await fetchHostDetections(ids);
    }
  }

  /**
   * Iterate Qualys vulnerabilities.
   *
   * @param qids the set of Qualys QIDs to fetch vulnerabilities
   * @param iteratee receives each vulnerability
   */
  public async iterateVulnerabilities(
    qids: number[],
    iteratee: ResourceIteratee<vmpc.Vuln>,
  ): Promise<void> {
    const fetchVulnerabilities = async (ids: number[]) => {
      const endpoint = '/api/2.0/fo/knowledge_base/vuln/';

      const params = new URLSearchParams({
        action: 'list',
        ids: ids.map(String),
      });

      const response = await this.executeAuthenticatedAPIRequest(
        this.qualysUrl(endpoint),
        { method: 'POST', body: params },
      );

      const responseText = await response.text();
      const jsonFromXml = xmlParser.parse(
        responseText,
      ) as ListQualysVulnerabilitiesResponse;
      const vulns: vmpc.Vuln[] = toArray(
        jsonFromXml.KNOWLEDGE_BASE_VULN_LIST_OUTPUT?.RESPONSE?.VULN_LIST?.VULN,
      );

      for (const vuln of vulns) {
        await iteratee(vuln);
      }
    };

    // Starting simple, sequential requests for pages. Once client supports
    // concurrency, add to queue to allow concurrency control.
    for (const ids of chunk(qids, 300)) {
      await fetchVulnerabilities(ids);
    }
  }

  public async executeAuthenticatedAPIRequest(
    info: RequestInfo,
    init: RequestInit,
  ): Promise<Response> {
    return this.executeAPIRequest(info, {
      ...init,
      headers: {
        ...init.headers,
        'x-requested-with': '@jupiterone/graph-qualys',
        authorization: this.qualysAuthorization(),
      },
      size: 0,
      timeout: 0,
    });
  }

  private async executeAPIRequest(
    info: RequestInfo,
    init: RequestInit,
  ): Promise<Response> {
    const apiResponse = await executeAPIRequest(this.events, {
      url: info as string,
      exec: () => fetch(info, init),
      retryConfig: this.retryConfig,
      rateLimitConfig: this.rateLimitConfig,
      rateLimitState: { ...this.rateLimitState },
    });

    // NOTE: This is NOT thread safe at this time.
    this.rateLimitState = apiResponse.rateLimitState;

    if (!apiResponse.completed && apiResponse.request.retryable) {
      const err = new Error(
        `Could not complete request within ${apiResponse.request.totalAttempts} attempts!`,
      );
      Object.assign(err, {
        statusText: apiResponse.statusText,
        status: apiResponse.status,
        code: apiResponse.status,
      });
      throw err;
    }

    if (apiResponse.status >= 400) {
      const err = new Error(
        `API request error for ${info}: ${apiResponse.statusText}`,
      );
      Object.assign(err, {
        statusText: apiResponse.statusText,
        status: apiResponse.status,
        code: apiResponse.status,
      });
      throw err;
    }

    return apiResponse.response;
  }

  private qualysAuthorization(): string {
    const authBuffer = Buffer.from(
      `${this.config.qualysUsername}:${this.config.qualysPassword}`,
      'ascii',
    );
    return `Basic ${authBuffer.toString('base64')}`;
  }

  private qualysUrl(
    path: string,
    query?: querystring.ParsedUrlQueryInput,
  ): string {
    if (query) {
      path += '?' + querystring.stringify(query);
    }
    return `${this.config.qualysApiUrl}${path}`;
  }
}
