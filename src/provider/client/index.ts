import * as crypto from 'crypto';
import EventEmitter from 'events';
import xmlParser from 'fast-xml-parser';
import chunk from 'lodash/chunk';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import PQueue from 'p-queue';
import querystring from 'querystring';
import { URLSearchParams } from 'url';
import { v4 as uuid } from 'uuid';

import {
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';

import { QualysIntegrationConfig } from '../../types';
import { executeAPIRequest } from './request';
import {
  assets,
  ClientDelayedRequestEvent,
  ClientEvents,
  ClientRequestEvent,
  ClientResponseEvent,
  QWebHostId,
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
import { QualysV2ApiErrorResponse } from './types/vmpc/errorResponse';
import { ListWebAppFindingsFilters } from './types/was';
import { calculateConcurrency, toArray } from './util';
import { buildServiceRequestBody } from './was/util';
import _ from 'lodash';

export * from './types';

/**
 * Number of host IDs to fetch per request.
 */
const DEFAULT_HOST_IDS_PAGE_SIZE = 10000;

/**
 * Number of hosts to fetch details for per request.
 */
const DEFAULT_HOST_DETAILS_PAGE_SIZE = 250;

/**
 * Number of hosts to fetch detections for per request. This is NOT the number
 * of detections, an important distinction!
 */
const DEFAULT_HOST_DETECTIONS_PAGE_SIZE = 1000;

/**
 * Number of Qualys vulnerabilities to fetch details for per request.
 */
const DEFAULT_VULNERABILITIES_PAGE_SIZE = 250;

const CONCURRENCY_LIMIT_RESPONSE_ERROR_CODE = 1960;
const RATE_LIMIT_RESPONSE_ERROR_CODE = 1965;

const RETRYABLE_409_CODES = [
  CONCURRENCY_LIMIT_RESPONSE_ERROR_CODE,
  RATE_LIMIT_RESPONSE_ERROR_CODE,
];

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  noRetryStatusCodes: [400, 401, 403, 404, 413],
  canRetry: async (response) => {
    if (response.status === 409) {
      try {
        const body = await response.text();
        const errorResponse = xmlParser.parse(body) as QualysV2ApiErrorResponse;
        if (errorResponse.SIMPLE_RETURN) {
          return {
            retryable: RETRYABLE_409_CODES.includes(
              errorResponse.SIMPLE_RETURN.RESPONSE.CODE,
            ),
            reason: errorResponse.SIMPLE_RETURN.RESPONSE.TEXT,
          };
        }
      } catch (err) {
        return {
          retryable: false,
          reason: `Could not read 409 response body: ${err.message}`,
        };
      }
    }
  },
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

export type ResourceIteratee<T> = (each: T) => Promise<void> | void;

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

  public onResponse(
    eventHandler: (event: ClientResponseEvent) => void,
    options?: { path?: string },
  ): (...args: any[]) => void {
    if (options?.path) {
      const path = options.path;
      const registeredHandler = (event: ClientResponseEvent) => {
        if (event.url.includes(path)) {
          eventHandler(event);
        }
      };
      this.events.on(ClientEvents.RESPONSE, registeredHandler);
      return registeredHandler;
    } else {
      this.events.on(ClientEvents.RESPONSE, eventHandler);
      return eventHandler;
    }
  }

  public removeResponseListener(listener: (...args: any[]) => void): void {
    this.events.removeListener(ClientEvents.RESPONSE, listener);
  }

  public async verifyAuthentication(): Promise<void> {
    const endpoint = '/api/2.0/fo/activity_log/';
    let response;
    try {
      response = await this.executeAuthenticatedAPIRequest(
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

    const isXML = /text\/xml/.test(response.headers.get('content-type'));
    if (isXML) {
      const responseText = await response.text();
      const jsonFromXml = xmlParser.parse(
        responseText,
      ) as QualysV2ApiErrorResponse;
      const { CODE, TEXT } = (jsonFromXml as any)?.SIMPLE_RETURN?.RESPONSE;
      const isError = CODE && TEXT;
      if (isError) {
        throw new IntegrationValidationError(
          `Unexpected responseCode in authentication verification: ${CODE}: ${TEXT}`,
        );
      }
    }
  }

  public validateApiUrl(): void {
    const apiUrlPrefix = 'https://qualysapi';
    if (!this.config.qualysApiUrl.startsWith(apiUrlPrefix)) {
      throw new IntegrationValidationError(
        `Api url does not begin with ${apiUrlPrefix}. Please ensure you are providing the api url specified by your Qualys platform host as seen under the "API URLs" section here: https://www.qualys.com/platform-identification/`,
      );
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
          body: buildServiceRequestBody({
            limit,
            offset,
            filters: options?.filters,
          }),
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
    options?: {
      filters?: was.ListWebAppFindingsFilters;
      pagination?: { limit: number; offset?: number };
      // TODO make this a required argument and update tests
      onRequestError?: (pageIds: number[], err: Error) => void;
    },
  ): Promise<void> {
    const fetchWebAppFindings = async (ids: number[]) => {
      const endpoint = '/qps/rest/3.0/search/was/finding/';
      const filters: ListWebAppFindingsFilters = {
        ...options?.filters,
        'webApp.id': ids,
      };

      // The WAS APIs have no rate limits on them; iterate in smaller batches to
      // keep memory pressure low.
      const limit = options?.pagination?.limit || 250;
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
            body: buildServiceRequestBody({ limit, offset, filters }),
            timeout: 1000 * 60 * 5,
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

        for (const finding of toArray(
          jsonFromXml.ServiceResponse?.data?.Finding,
        )) {
          await iteratee(finding);
        }

        hasMoreRecords = !!jsonFromXml.ServiceResponse?.hasMoreRecords;

        if (hasMoreRecords) {
          offset += limit;
        }
      } while (hasMoreRecords);
    };

    const webAppFindingsQueue = new PQueue({
      concurrency: 3,
    });

    for (const ids of chunk(webAppIds, 10)) {
      webAppFindingsQueue
        .add(async () => {
          await fetchWebAppFindings(ids);
        })
        .catch((err) => {
          options?.onRequestError?.(ids, err);
        });
    }

    await webAppFindingsQueue.onIdle();
  }

  /**
   * Answers the complete set of scanned `QWebHostId`s provided by the Qualys VMDR
   * module. This does not include hosts that have never been scanned.
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
    const jsonFromXml = xmlParser.parse(
      responseText,
    ) as vmpc.ListScannedHostIdsResponse;
    return toArray(jsonFromXml.HOST_LIST_OUTPUT?.RESPONSE?.ID_SET?.ID);
  }

  /**
   * Answers the complete set of scanned host IDs provided by the Qualys VMDR
   * module. This does not include hosts that have never been scanned.
   *
   * @param iteratee receives each page of host ID values
   * @param options optional values for pagination
   */
  public async iterateScannedHostIds(
    iteratee: ResourceIteratee<QWebHostId[]>,
    options?: {
      filters?: vmpc.ListScannedHostIdsFilters;
      pagination?: vmpc.ListScannedHostIdsPagination;
    },
  ): Promise<void> {
    type ListHostIdsResponse = {
      nextUrl?: string;
      hostIds: QWebHostId[];
    };

    const buildHostIdsResponse = async (
      response: Response,
    ): Promise<ListHostIdsResponse> => {
      const responseText = await response.text();
      const jsonFromXml = xmlParser.parse(
        responseText,
      ) as vmpc.ListScannedHostIdsResponse;

      const hostListIds = toArray(
        jsonFromXml.HOST_LIST_OUTPUT?.RESPONSE?.HOST_LIST?.HOST,
      ).map((host) => host.ID!);
      const idSetIds = toArray(
        jsonFromXml.HOST_LIST_OUTPUT?.RESPONSE?.ID_SET?.ID,
      );

      return {
        hostIds: hostListIds.length > 0 ? hostListIds : idSetIds,
        nextUrl: jsonFromXml.HOST_LIST_OUTPUT?.RESPONSE?.WARNING?.URL,
      };
    };

    const endpoint = '/api/2.0/fo/asset/host/';
    console.log('not a thing');
    const response = await this.executeAuthenticatedAPIRequest(
      this.qualysUrl(endpoint, {
        action: 'list',
        details: 'None',
        truncation_limit:
          options?.pagination?.limit || DEFAULT_HOST_IDS_PAGE_SIZE,
        ...options?.filters,
      }),
      { method: 'GET' },
    );

    let hostIdsResponse = await buildHostIdsResponse(response);
    await iteratee(hostIdsResponse.hostIds);

    while (hostIdsResponse.nextUrl) {
      const response = await this.executeAuthenticatedAPIRequest(
        hostIdsResponse.nextUrl,
        { method: 'GET' },
      );

      hostIdsResponse = await buildHostIdsResponse(response);
      await iteratee(hostIdsResponse.hostIds);
    }
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
    hostIds: QWebHostId[],
    iteratee: ResourceIteratee<assets.HostAsset>,
    options?: {
      pagination?: { limit: number };
      // TODO make this a required argument and update tests
      onRequestError?: (pageIds: number[], err: Error) => void;
    },
  ): Promise<void> {
    const fetchHostDetails = async (ids: QWebHostId[]) => {
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
          timeout: 1000 * 60 * 5,
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
            `Unexpected responseCode in ServiceResponse: ${responseCode}\n${responseText}`,
          ),
          endpoint,
          status: response.status,
          statusText: responseCode,
        });
      }

      return toArray(jsonFromXml.ServiceResponse?.data?.HostAsset);
    };

    const hostDetailsQueue = new PQueue({
      concurrency: 3,
    });

    for (const ids of chunk(
      hostIds,
      options?.pagination?.limit || DEFAULT_HOST_DETAILS_PAGE_SIZE,
    )) {
      hostDetailsQueue
        .add(async () => {
          const hosts = await fetchHostDetails(ids);
          for (const host of hosts) {
            await iteratee(host);
          }
        })
        .catch((err) => {
          options?.onRequestError?.(ids, err);
        });
    }

    await hostDetailsQueue.onIdle();
  }

  /**
   * Fetch host details from asset manager.
   *
   * @param hostId a QWEB host ID
   */
  public async fetchHostDetails(hostId: QWebHostId): Promise<assets.HostAsset> {
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
   * > Maximum benefit has seen when the batch size is set evenly throughout the
   * > number of parallel threads used. For example, a host detection call
   * > resulting in a return of 100k assets, and using 10 threads in parallel,
   * > would benefit the most by using a batch size of (100,000 / 10) = 10,000.
   * > To reduce having one thread slow down the entire process by hitting a
   * > congested server, you can break this out further into batches of 5,000
   * > hosts, resulting in 20 output files.
   * >   - https://www.qualys.com/docs/qualys-api-vmpc-user-guide.pdf
   *
   * @param hostIds the set of QWEB host IDs to fetch detections
   * @param iteratee receives each host and its detections
   */
  public async iterateHostDetections(
    hostIds: QWebHostId[],
    iteratee: ResourceIteratee<{
      host: vmpc.DetectionHost;
      detections: vmpc.HostDetection[];
    }>,
    options?: {
      filters?: vmpc.ListHostDetectionsFilters;
      pagination?: { limit: number };
      // TODO make this a required argument and update tests
      onRequestError?: (pageIds: number[], err: Error) => void;
    },
  ): Promise<void> {
    const endpoint = '/api/2.0/fo/asset/host/vm/detection/';

    const filters: Record<string, string> = {};
    if (options?.filters) {
      for (const [k, v] of Object.entries(options.filters)) {
        filters[k] = String(v);
      }
    }

    const fetchHostDetections = async (ids: QWebHostId[]) => {
      const params = new URLSearchParams({
        ...filters,
        action: 'list',
        show_tags: '1',
        show_igs: '1',
        output_format: 'XML',
        truncation_limit: String(ids.length),
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

    // Start with the standard subscription level until we know the current
    // state after we get a response.
    let rateLimitState = STANDARD_RATE_LIMIT_STATE;
    const requestQueue = new PQueue({
      concurrency: calculateConcurrency(rateLimitState),
    });

    const concurrencyResponseHandler = this.onResponse(
      (event) => {
        rateLimitState = event.rateLimitState;
        requestQueue.concurrency = calculateConcurrency(rateLimitState);
      },
      { path: endpoint },
    );

    for (const ids of chunk(
      hostIds,
      options?.pagination?.limit || DEFAULT_HOST_DETECTIONS_PAGE_SIZE,
    )) {
      requestQueue
        .add(async () => {
          await fetchHostDetections(ids);
        })
        .catch((err) => {
          options?.onRequestError?.(ids, err);
        });
    }

    await requestQueue.onIdle();

    this.removeResponseListener(concurrencyResponseHandler);
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
    options?: {
      pagination: { limit: number };
    },
  ): Promise<void> {
    const fetchVulnerabilities = async (ids: number[]) => {
      const endpoint = '/api/2.0/fo/knowledge_base/vuln/';

      // The documenation for this endpoint provides no indication of support
      // for `truncation_limit`.
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
    for (const ids of chunk(
      qids,
      options?.pagination?.limit || DEFAULT_VULNERABILITIES_PAGE_SIZE,
    )) {
      await fetchVulnerabilities(ids);
    }
  }

  public async executeAuthenticatedAPIRequest(
    info: RequestInfo,
    init: RequestInit,
  ): Promise<Response> {
    return this.executeAPIRequest(info, {
      timeout: 0,
      ...init,
      headers: {
        ...init.headers,
        'x-requested-with': '@jupiterone/graph-qualys',
        authorization: this.qualysAuthorization(),
      },
      size: 0,
    });
  }

  private hashAPIRequest(init: RequestInit) {
    let fingerprint: string | undefined;

    if (typeof init.body?.toString === 'function') {
      fingerprint = init.body.toString();
    } else if (typeof init.body === 'string') {
      fingerprint = init.body;
    } else if (init.body) {
      fingerprint = JSON.stringify(init.body);
    }

    if (!fingerprint || fingerprint === '{}') {
      fingerprint = uuid();
    }

    const shasum = crypto.createHash('sha1');
    shasum.update(fingerprint);
    return shasum.digest('hex');
  }

  private async executeAPIRequest(
    info: RequestInfo,
    init: RequestInit,
  ): Promise<Response> {
    const apiResponse = await executeAPIRequest(this.events, {
      url: info as string,
      hash: this.hashAPIRequest(init),
      exec: () => fetch(info, init),
      retryConfig: this.retryConfig,
      rateLimitConfig: this.rateLimitConfig,
      rateLimitState: { ...this.rateLimitState },
    });

    // NOTE: This is NOT thread safe at this time.
    // TODO: Do not track on the instance, should be endpoint-specific state
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
      let statusText = apiResponse.statusText;
      if (apiResponse.request.retryDecision) {
        statusText = `${statusText} ${apiResponse.request.retryDecision.reason}`;
      }

      const err = new Error(
        `API request error for ${info}: ${apiResponse.statusText}`,
      );
      Object.assign(err, {
        statusText,
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
