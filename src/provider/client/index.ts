import * as crypto from 'crypto';
import chunk from 'lodash/chunk';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';
import PQueue from 'p-queue';
import querystring from 'querystring';
import { URLSearchParams } from 'url';
import { v4 as uuid } from 'uuid';

import {
  IntegrationError,
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
  IntegrationProviderAuthorizationError,
} from '@jupiterone/integration-sdk-core';

import { UserIntegrationConfig } from '../../types';
import { withConcurrency } from './concurrency';
import { ClientEventEmitter, executeAPIRequest } from './request';
import {
  assets,
  ClientDelayedRequestEvent,
  ClientEvents,
  ClientRequestEvent,
  ClientResponseEvent,
  PortalInfo,
  qps,
  QWebHostId,
  RateLimitConfig,
  RateLimitState,
  ResourceIteratee,
  RetryConfig,
  SimpleReturn,
  vmpc,
  was,
} from './types';
import {
  extractServiceResponseFromResponseBody,
  isXMLResponse,
  parseXMLResponse,
  toArray,
} from './util';
import { buildServiceRequestBody } from './was/util';

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
 * Number of concurrent requests to fetch details.
 *
 * The Qualys docs suggest the Premium license supports a maximum of 10
 * concurrent requests, 2000 per hour, and the response headers should indicate
 * the subscription level. However, logs of these requests indicates these
 * headers are in fact not provided by this endpoint.
 *
 * This represents a common pattern of instability in the API:
 *
 * 1. `21:38:48.212 Sending request...`
 * 2. `21:43:48.222 Sending request...`
 * 3. `21:43:48.226 Request failed, reason: socket hang up`
 * 4. `21:45:20.246 Received response`
 *
 * Notice that the first request times out after 5 minutes, but the second
 * attempt for the same amount of data/host IDs succeeds in 1.5 minutes. It is
 * not clear whether waiting longer than 5 minutes would have helped, nor
 * whether timing out at 2 minutes would be the better approach.
 *
 * Attempted combinations:
 *
 * - 🚫 page 250, concurrency 10, timeout 5min
 * - 🚫 page 500, concurrency 15, timeout 10min
 * - 🚫 page 1000, concurrency 20, timeout 10min
 * - page 1000, concurrency 5, timeout 10min
 */
const DEFAULT_HOST_DETAILS_CONCURRENCY = 10;

/**
 * Time to wait for data to come back from host details endpoint.
 */
const DEFAULT_HOST_DETAILS_SOCKET_TIMEOUT_MS = 1000 * 60 * 5;

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

const ERROR_CODE_ACCOUNT_EXPIRED = 2001;

const QPS_REST_ENDPOINT = new RegExp(
  '/qps/rest/([23]\\.0|portal)/.+',
).compile();

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  noRetryStatusCodes: [400, 401, 403, 404, 413],
  canRetry: async (response) => {
    if (response.status === 409) {
      const errorDetails = await (response as QualysAPIResponse).errorDetails();
      if (errorDetails) {
        return {
          retryable: RETRYABLE_409_CODES.includes(errorDetails.code),
          reason: errorDetails.text,
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
  config: UserIntegrationConfig;

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

export type IterateHostDetectionsOptions = {
  /**
   * Filters provided to the listHostDetections API. This reduces the amount of
   * data fetched from the Qualys API.
   */
  filters?: vmpc.ListHostDetectionsFilters;
  pagination?: { limit: number };

  /**
   * Include detection results data when listing host detections. This is
   * expensive due to the increased number of bytes transferred and processed in
   * the XML payload.
   */
  includeResults?: boolean;

  // TODO make this a required argument and update tests
  onRequestError?: (pageIds: number[], err: Error) => void;
};

/**
 * An extension of a Response to simplify access to the body of SIMPLE_RETURN
 * responses.
 */
type QualysAPIResponse = Response & {
  /**
   * Consume the body and return a Promise that resolves SIMPLE_RETURN content.
   * The result is cached since the body is consumed, to allow multiple calls.
   *
   * @returns SimpleReturn or undefined when the body is unavailable or not XML
   */
  simpleReturn: () => Promise<SimpleReturn | undefined>;

  /**
   * Consume the body and return a Promise that resolves details of error
   * responses. The result is cached since the body is consumed, to allow
   * multiple calls.
   *
   * @returns QualysAPIErrorDetails or undefined when the response is not an
   * error or the body is unavailable or not XML
   */
  errorDetails: () => Promise<QualysAPIErrorDetails | undefined>;
};

type QualysAPIErrorDetails = {
  status: number;
  code: number;
  text: string;
};

function createQualysAPIResponse(response: Response): QualysAPIResponse {
  const apiResponse = response as QualysAPIResponse;

  let hasParsedResponse: boolean = false;
  let simpleReturn: SimpleReturn | undefined;
  let errorDetails: QualysAPIErrorDetails | undefined;

  apiResponse.simpleReturn = async () => {
    if (!hasParsedResponse) {
      if (isXMLResponse(response)) {
        simpleReturn = await parseXMLResponse<SimpleReturn>(response);
        hasParsedResponse = true;
      }
    }
    return simpleReturn;
  };

  // Note the Qualys API docs for VMPC state:
  //
  // > For an API request that had an error, you’ll find the error code and text
  // > in the XML response.
  //
  // This may not be the case for other APIs, in which case this function may
  // need to be extended or better, some refactoring could avoid reusing this
  // client code across APIs.
  //
  apiResponse.errorDetails = async () => {
    if (response.status >= 400 && !hasParsedResponse) {
      const errorResponse = (await apiResponse.simpleReturn())?.SIMPLE_RETURN
        ?.RESPONSE;
      if (errorResponse) {
        errorDetails = {
          status: response.status,
          code: errorResponse.CODE,
          text: errorResponse.TEXT,
        };
      }
    }
    return errorDetails;
  };

  return apiResponse;
}

export class QualysAPIClient {
  private events: ClientEventEmitter;

  private config: UserIntegrationConfig;
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
    this.events = new ClientEventEmitter();
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
  ): void {
    this.events.on(ClientEvents.RESPONSE, eventHandler, options);
  }

  /**
   * Uses the Activity Log endpoint to fetch a single record for the username
   * provided to execute the integration to verify that authentication works.
   *
   * ```sh
   * curl -u "username:password" -k \
   *   -H "X-Requested-With:curl" \
   *   "https://qualysapi.qualys.com/api/2.0/fo/activity_log/?action=list&username=username&truncation_limit=1"
   * ```
   *
   * The response body contains CSV on 200, XML on some other error responses.
   */
  public async verifyAuthentication(): Promise<void> {
    const endpoint = '/api/2.0/fo/activity_log/';

    let response: QualysAPIResponse | undefined = undefined;
    try {
      response = await this.executeAuthenticatedAPIRequest(
        this.qualysUrl(endpoint, {
          action: 'list',
          username: this.config.qualysUsername,
          truncation_limit: 1,
        }),
        {
          method: 'GET',
          timeout: 60000, // Setting timeout for this call to 1min. This is a lightweight call
        },
      );
    } catch (err) {
      const status = err.status || err.code;
      const statusText = err.statusText || err.message;

      if (
        status === 400 &&
        /Unrecognized parameter\(s\): username/.test(statusText)
      ) {
        // "The API request contained one or more parameters which are not
        // supported, or are not available to the browsing user." Since 401 is
        // documented as "Bad Login/Password", we're going to assume we
        // authenticated and this user is simply unable to view the
        // activity_log.
      } else {
        throw new IntegrationProviderAuthenticationError({
          cause: err,
          endpoint,
          status,
          statusText,
        });
      }
    }

    const simpleReturn = await response?.simpleReturn();
    if (response && simpleReturn?.SIMPLE_RETURN?.RESPONSE) {
      const { CODE, TEXT } = simpleReturn.SIMPLE_RETURN?.RESPONSE;
      const isError = CODE && TEXT;
      if (isError) {
        const apiError = new IntegrationProviderAPIError({
          endpoint,
          status: response.status,
          statusText: response.statusText,
          code: String(CODE),
          message: `Unexpected responseCode in authentication verification: ${CODE}: ${TEXT}`,
        });
        if (CODE === ERROR_CODE_ACCOUNT_EXPIRED) {
          throw new IntegrationProviderAuthenticationError({
            cause: apiError,
            endpoint,
            status: response.status,
            statusText: response.statusText,
          });
        } else {
          throw apiError;
        }
      }
    }
  }

  public async fetchPortalInfo(): Promise<PortalInfo | undefined> {
    const endpoint = '/qps/rest/portal/version';
    const response = await this.executeQpsRestAPIRequest(
      this.qualysUrl(endpoint, {}),
      {
        method: 'GET',
      },
    );
    return response.ServiceResponse?.data as PortalInfo;
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
      const response = await this.executeQpsRestAPIRequest<
        was.ListWebAppsResponse
      >(this.qualysUrl(endpoint, {}), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
        },
        body: buildServiceRequestBody({
          limit,
          offset,
          filters: options?.filters,
        }),
      });

      for (const webApp of toArray(response.ServiceResponse?.data?.WebApp)) {
        await iteratee(webApp);
      }

      hasMoreRecords = !!response.ServiceResponse?.hasMoreRecords;

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
    options: {
      filters?: was.ListWebAppFindingsFilters;
      pagination?: { limit: number; offset?: number };
      onRequestError: (pageIds: number[], err: Error) => void;
    },
  ): Promise<void> {
    const fetchWebAppFindings = async (ids: number[]) => {
      const endpoint = '/qps/rest/3.0/search/was/finding/';
      const filters: was.ListWebAppFindingsFilters = {
        ...options?.filters,
        'webApp.id': ids,
      };

      // The WAS APIs have no rate limits on them; iterate in smaller batches to
      // keep memory pressure low.
      const limit = options?.pagination?.limit || 250;
      let offset = options?.pagination?.offset || 1;

      let hasMoreRecords = true;
      do {
        const response = await this.executeQpsRestAPIRequest<
          was.ListWebAppFindingsResponse
        >(this.qualysUrl(endpoint, {}), {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml',
          },
          body: buildServiceRequestBody({ limit, offset, filters }),
          timeout: 1000 * 60 * 5,
        });

        for (const finding of toArray(
          response.ServiceResponse?.data?.Finding,
        )) {
          await iteratee(finding);
        }

        hasMoreRecords = !!response.ServiceResponse?.hasMoreRecords;

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

    const jsonFromXml = await parseXMLResponse<vmpc.ListScannedHostIdsResponse>(
      response,
    );
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
      const jsonFromXml = await parseXMLResponse<
        vmpc.ListScannedHostIdsResponse
      >(response);

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
   * * [API Documentation](https://www.qualys.com/docs/qualys-asset-management-tagging-api-v2-user-guide.pdf)
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

      const response = await this.executeQpsRestAPIRequest<
        assets.SearchHostAssetResponse
      >(this.qualysUrl(endpoint, {}), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
        },
        body,
        timeout: DEFAULT_HOST_DETAILS_SOCKET_TIMEOUT_MS,
      });

      return toArray(response.ServiceResponse?.data?.HostAsset);
    };

    const hostDetailsQueue = new PQueue({
      concurrency: DEFAULT_HOST_DETAILS_CONCURRENCY,
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

    const response = await this.executeQpsRestAPIRequest<
      assets.SearchHostAssetResponse
    >(this.qualysUrl(endpoint, {}), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
      },
      body,
    });

    const assets = toArray(response.ServiceResponse?.data?.HostAsset);
    if (assets.length != 1)
      throw new IntegrationError({
        message: `Unexpected response, no host details for host ID ${JSON.stringify(
          hostId,
        )}`,
        code: 'HOST_DETAILS_NOT_FOUND',
        fatal: false,
      });

    return assets[0];
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
   * @param options configure detection fetch parameters
   */
  public async iterateHostDetections(
    hostIds: QWebHostId[],
    iteratee: ResourceIteratee<{
      host: vmpc.DetectionHost;
      detections: vmpc.HostDetection[];
    }>,
    options?: IterateHostDetectionsOptions,
  ): Promise<void> {
    const endpoint = '/api/2.0/fo/asset/host/vm/detection/';

    const filters: Record<string, string> = {};
    if (options?.filters) {
      for (const [k, v] of Object.entries(options.filters)) {
        if (v && (!Array.isArray(v) || v.length > 0)) {
          filters[k] = String(v);
        }
      }
    }

    // Ensure we drop from memory the XML string after parsing it
    const fetchHostDetections = async (
      ids: QWebHostId[],
    ): Promise<vmpc.DetectionHost[]> => {
      const params = new URLSearchParams({
        ...filters,
        action: 'list',
        show_tags: '1',
        show_igs: '1',
        show_results: !!options?.includeResults ? '1' : '0',
        output_format: 'XML',
        truncation_limit: String(ids.length),
        ids: ids.map(String),
      });

      const response = await this.executeAuthenticatedAPIRequest(
        this.qualysUrl(endpoint),
        { method: 'POST', body: params },
      );

      const jsonFromXml = await parseXMLResponse<
        vmpc.ListHostDetectionsResponse
      >(response);
      return toArray(
        jsonFromXml.HOST_LIST_VM_DETECTION_OUTPUT?.RESPONSE?.HOST_LIST?.HOST,
      );
    };

    const performIteration = async (ids: QWebHostId[]) => {
      for (const host of await fetchHostDetections(ids)) {
        await iteratee({
          host,
          detections: toArray(host.DETECTION_LIST?.DETECTION),
        });
      }
    };

    await withConcurrency(
      (queue) => {
        for (const ids of chunk(
          hostIds,
          options?.pagination?.limit || DEFAULT_HOST_DETECTIONS_PAGE_SIZE,
        )) {
          queue
            .add(async () => {
              await performIteration(ids);
            })
            .catch((err) => {
              options?.onRequestError?.(ids, err);
            });
        }
      },
      { events: this.events, rateLimitState: STANDARD_RATE_LIMIT_STATE },
    );
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
    options: {
      pagination?: { limit: number };
      onRequestError: (pageIds: number[], err: Error) => void;
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

      const jsonFromXml = await parseXMLResponse<
        vmpc.ListQualysVulnerabilitiesResponse
      >(response);
      return toArray(
        jsonFromXml.KNOWLEDGE_BASE_VULN_LIST_OUTPUT?.RESPONSE?.VULN_LIST?.VULN,
      );
    };

    const performIteration = async (ids: number[]) => {
      for (const vuln of await fetchVulnerabilities(ids)) {
        await iteratee(vuln);
      }
    };

    await withConcurrency(
      (queue) => {
        for (const ids of chunk(
          qids,
          options.pagination?.limit || DEFAULT_VULNERABILITIES_PAGE_SIZE,
        )) {
          queue
            .add(async () => {
              await performIteration(ids);
            })
            .catch((err) => {
              options.onRequestError(ids, err);
            });
        }
      },
      {
        events: this.events,
        rateLimitState: STANDARD_RATE_LIMIT_STATE,
      },
    );
  }

  /**
   * @throws IntegrationProviderAPIError
   */
  public async executeAuthenticatedAPIRequest(
    info: RequestInfo,
    init: RequestInit,
  ): Promise<QualysAPIResponse> {
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

  /**
   * Executes an API request and processes the body, handling 200 responses with
   * embedded error codes.
   *
   * @param endpoint an API endpoint having a path matching
   * `/qps/rest/:version/*`
   * @param init RequestInit argument for fetch
   *
   * @throws `TypeError` when request endpoint does not look like a QPS REST
   * value
   * @throws `IntegrationError` for unexpected response content-type
   * @throws `IntegrationProviderAPIError` when responseCode in 200 response body indicates an error
   * @throws `IntegrationProviderAuthorizationError` when Qualys license has
   * expired, an error that should be reported to user, not operator
   */
  private async executeQpsRestAPIRequest<
    T extends qps.ServiceResponseBody<any>
  >(endpoint: string, init: RequestInit): Promise<T> {
    if (!QPS_REST_ENDPOINT.test(endpoint))
      throw new TypeError(
        `Invalid QPS REST endpoint ${JSON.stringify(
          endpoint,
        )}, expected ${JSON.stringify(QPS_REST_ENDPOINT)}`,
      );

    const response = await this.executeAuthenticatedAPIRequest(endpoint, init);
    try {
      const bodyT = await extractServiceResponseFromResponseBody<T>(
        endpoint,
        response,
      );
      return bodyT;
    } catch (err) {
      switch (err.code) {
        case 'EVALUATION_EXPIRED':
          throw new IntegrationProviderAuthorizationError({
            cause: err,
            endpoint,
            status: response.status,
            statusText: response.statusText,
          });
        default:
          throw err;
      }
    }
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

  /**
   * Executes a request and returns a response.
   *
   * Builds an APIRequest to include details for retry and rate limit management
   * and delegates execution to the `executeAPIRequest` utility function, which
   * handles retrying based on response codes and rate limit headers.
   *
   * @throws `IntegrationProviderAPIError` when request cannot be completed within
   * this.retryConfig.maxAttempts
   * @throws `IntegrationProviderAPIError` when response status indicates a failure
   */
  private async executeAPIRequest(
    info: RequestInfo,
    init: RequestInit,
  ): Promise<QualysAPIResponse> {
    const endpoint = info as string;
    const apiResponse = await executeAPIRequest(this.events, {
      url: endpoint,
      hash: this.hashAPIRequest(init),
      exec: async () => {
        const response = await fetch(info, init);
        return createQualysAPIResponse(response);
      },
      retryConfig: this.retryConfig,
      rateLimitConfig: this.rateLimitConfig,
      rateLimitState: { ...this.rateLimitState },
    });

    // NOTE: This is NOT thread safe at this time.
    // TODO: Do not track on the instance, should be endpoint-specific state
    this.rateLimitState = apiResponse.rateLimitState;

    const qualysResponse = apiResponse.response as QualysAPIResponse;
    const status = apiResponse.status;
    let statusText = apiResponse.statusText;

    if (!apiResponse.completed && apiResponse.request.retryable) {
      throw new IntegrationProviderAPIError({
        message: `Could not complete request within ${apiResponse.request.totalAttempts} attempts!`,
        endpoint,
        status,
        statusText,
      });
    }

    if (apiResponse.status >= 400) {
      if (apiResponse.request.retryDecision) {
        statusText = `${statusText} ${apiResponse.request.retryDecision.reason}`;
      }

      const errorDetails = await qualysResponse.errorDetails();
      if (errorDetails) {
        statusText = `${statusText} (${JSON.stringify(errorDetails)})`;
      }

      throw new IntegrationProviderAPIError({
        message: `API request error for ${info}: ${apiResponse.statusText}`,
        endpoint,
        status,
        statusText,
      });
    }

    return qualysResponse;
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
