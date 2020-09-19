import xmlParser from 'fast-xml-parser';
import fetch, { Headers, Request, Response } from 'node-fetch';
import querystring from 'querystring';

import { retry } from '@lifeomic/attempt';

import { QualysAssetManagementClient } from './assetManagement';
import { QualysClientApiError, QualysClientError } from './errors';
import { QualysKnowledgeBaseClient } from './knowledgeBase';
import { QualysVmClient } from './vulnerabilityManagement';
import { QualysWebApplicationScanningClient } from './webApplicationScanning';
import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

export type LoggerContext = {
  logger: IntegrationLogger;
};

export type BaseQualysApiMakeRequestOptions<T> = {
  requestName: string;
  responseType: QualysClientResponseType<T>;
  headers?: Record<string, string>;
  method: 'get' | 'post';
  body?: string;
  retryOnTimeout: boolean;
  maxAttempts: number;
};

export type QualysApiMakeRequestWithFullUrlOptions<
  T
> = BaseQualysApiMakeRequestOptions<T> & {
  url: string;
};

export type QualysApiMakeRequestOptions<T> = BaseQualysApiMakeRequestOptions<
  T
> & {
  path: string;
  query?: querystring.ParsedUrlQueryInput;
};

export type QualysApiResponse<T> = {
  response: Response;
  responseData: T;
  responseText: string | undefined;
};

export type QualysApiPaginatedResponse<T> = QualysApiResponse<T> & {
  hasNextPage: boolean;
  nextPage: (context: LoggerContext) => QualysApiResponse<T> | null;
};

export type QualysApiRequestResponse<T> = QualysApiResponse<T> & {
  request: Request;
  requestOptions: QualysApiMakeRequestWithFullUrlOptions<T>;
};

export type OnQualysApiResponse = (
  requestResponse: QualysApiRequestResponse<any>,
) => void;

export type QualysClientResponseType<T> = (
  text: string,
  response: Response,
) => T;

const TEXT_CONVERTER: QualysClientResponseType<string> = (text, response) => {
  return text;
};

const JSON_CONVERTER: QualysClientResponseType<Record<string, unknown>> = (
  text,
  response,
) => {
  return JSON.parse(text);
};

const XML_TO_JSON_CONVERTER: QualysClientResponseType<Record<
  string,
  unknown
>> = (text, response) => {
  return xmlParser.parse(text);
};

const NONE_CONVERTER: QualysClientResponseType<undefined> = (
  text,
  response,
) => {
  return undefined;
};

export const QualysClientResponseType = {
  TEXT: TEXT_CONVERTER,
  JSON: JSON_CONVERTER,
  XML: XML_TO_JSON_CONVERTER,
  NONE: NONE_CONVERTER,
};

const REQUESTED_WITH = '@jupiterone/graph-qualys';

export type QualysApiResponsePaginator<T> = {
  hasNextPage: () => boolean;
  nextPage: (context: LoggerContext) => Promise<QualysApiResponse<T>>;
  getNextRequest: () => QualysApiNextRequestWithPageIndex<T> | null;
};

/**
 * The `QualysApiNextRequest` type describes the parameters that are needed
 * to make another request when paginating.
 * The `lastId` property will be undefined for the initial request.
 */
export type QualysApiNextRequest<T> = {
  url: string;
  headers?: Record<string, string>;
  body?: string;
  /**
   * `cursor` is used for logging purposes
   */
  cursor: string | undefined;
  lastResponse: QualysApiResponse<T> | null;
  logData: Record<string, unknown>;
};

export type QualysApiNextRequestWithPageIndex<T> = QualysApiNextRequest<T> & {
  pageIndex: number;
};

export type BuildNextPageRequestFunction<T> = (
  context: LoggerContext,
  lastResponse: QualysApiResponse<T>,
) => QualysApiNextRequest<T> | null;

export type BuildPageRequestToRetryAfterTimeout<T> = (
  context: LoggerContext,
  lastResponse: QualysApiResponse<T> | null,
) => QualysApiNextRequest<T> | null;

export function buildQualysClientPaginator<T>(
  qualysClient: QualysClient,
  options: {
    requestName: string;
    url: string;
    method: 'get' | 'post';
    headers?: Record<string, string>;
    body?: string;
    maxAttempts: number;
    logData: Record<string, unknown>;
    responseType: QualysClientResponseType<T>;
    buildNextPageRequest: BuildNextPageRequestFunction<T>;
    buildPageRequestToRetryAfterTimeout: BuildPageRequestToRetryAfterTimeout<T>;
  },
): QualysApiResponsePaginator<T> {
  const { buildNextPageRequest, buildPageRequestToRetryAfterTimeout } = options;

  // Build the initial request
  let nextRequest: QualysApiNextRequestWithPageIndex<T> | null = {
    url: options.url,
    body: options.body,
    headers: options.headers,

    // No `cursor` for initial request
    cursor: undefined,

    pageIndex: 0,

    lastResponse: null,

    logData: options.logData,
  };

  const seenCursors = new Set<string>();

  const paginator: QualysApiResponsePaginator<T> = {
    hasNextPage: () => {
      return !!nextRequest;
    },

    getNextRequest: () => {
      return nextRequest;
    },

    nextPage: async (context) => {
      if (!nextRequest) {
        throw new QualysClientError({
          code: 'NO_NEXT_PAGE',
          message: '"nextPage" called but there is no next page',
        });
      }

      let currentRequest = nextRequest;
      let currentResponse: QualysApiRequestResponse<T> | undefined;
      let attemptsRemaining = options.maxAttempts;

      let logger = context.logger;

      do {
        attemptsRemaining--;

        logger = context.logger.child({
          ...currentRequest.logData,
          requestName: options.requestName,
          pageIndex: currentRequest.pageIndex,
          cursor: currentRequest.cursor,
          url: currentRequest.url,
        });

        try {
          logger.info('Fetching page...');
          currentResponse = await qualysClient.makeRequestWithFullUrl<T>({
            requestName: options.requestName,
            responseType: options.responseType,
            method: options.method,
            url: currentRequest!.url,
            headers: currentRequest!.headers,
            body: currentRequest!.body,

            // Do not retry on timeout
            retryOnTimeout: false,

            // We have our own retry logic in this function
            // so only make one attempt
            maxAttempts: 1,
          });
          logger.info('Fetched page');
        } catch (err) {
          if (attemptsRemaining === 0) {
            logger.warn(
              {
                maxAttempts: options.maxAttempts,
                err,
              },
              'Qualys API failed to get next page within max number of attempts',
            );
            throw err;
          }

          if (err.code === 'ATTEMPT_TIMEOUT') {
            const requestForRetry = buildPageRequestToRetryAfterTimeout(
              { logger },
              nextRequest.lastResponse,
            ) as QualysApiNextRequestWithPageIndex<T> | null;
            if (requestForRetry) {
              logger.warn(
                {
                  err,
                },
                'Qualys API request timed out (will retry)',
              );
              requestForRetry.pageIndex = currentRequest.pageIndex;
              currentRequest = requestForRetry;
            } else {
              logger.warn(
                {
                  err,
                },
                'Qualys API request timed out (will not retry)',
              );
              throw err;
            }
          } else {
            logger.warn(
              {
                err,
              },
              'Qualys API request failed (will retry)',
            );
          }
        }
      } while (!currentResponse);

      nextRequest = buildNextPageRequest(
        { logger },
        currentResponse,
      ) as QualysApiNextRequestWithPageIndex<T> | null;

      if (nextRequest) {
        nextRequest.pageIndex = currentRequest.pageIndex + 1;
        if (nextRequest.cursor) {
          if (seenCursors.has(nextRequest.cursor)) {
            throw new QualysClientError({
              code: 'DUPLICATE_CURSOR_WHILE_PAGINATING',
              message: 'Next page cursor matches a previously returned cursor',
            });
          }

          // Remember this cursor so that we can check for duplicate in future
          seenCursors.add(nextRequest.cursor);
        }
      }

      return currentResponse;
    },
  };

  return paginator;
}

export default class QualysClient {
  private readonly apiUrl: string;
  private readonly username: string;
  private readonly password: string;
  public readonly vulnerabilityManagement: QualysVmClient;
  public readonly knowledgeBase: QualysKnowledgeBaseClient;
  public readonly webApplicationScanning: QualysWebApplicationScanningClient;
  public readonly assetManagement: QualysAssetManagementClient;
  onResponse?: OnQualysApiResponse;

  constructor(config: {
    apiUrl: string;
    username: string;
    password: string;
    onResponse?: OnQualysApiResponse;
  }) {
    this.apiUrl = config.apiUrl;
    this.username = config.username;
    this.password = config.password;
    this.vulnerabilityManagement = new QualysVmClient(this);
    this.knowledgeBase = new QualysKnowledgeBaseClient(this);
    this.webApplicationScanning = new QualysWebApplicationScanningClient(this);
    this.assetManagement = new QualysAssetManagementClient(this);
    this.onResponse = config.onResponse;
  }

  buildRequestUrl(requestOptions: {
    apiUrl?: string;
    path: string;
    query?: querystring.ParsedUrlQueryInput;
  }): string {
    let path = requestOptions.path;
    if (requestOptions.query) {
      path += '?' + querystring.stringify(requestOptions.query);
    }
    return `${requestOptions.apiUrl || this.apiUrl}${path}`;
  }

  public async makeRequest<T>(
    requestOptions: QualysApiMakeRequestOptions<T>,
  ): Promise<QualysApiRequestResponse<T>> {
    return this.makeRequestWithFullUrl({
      requestName: requestOptions.requestName,
      responseType: requestOptions.responseType,
      headers: requestOptions.headers,
      url: this.buildRequestUrl(requestOptions),
      method: requestOptions.method,
      body: requestOptions.body,
      retryOnTimeout: requestOptions.retryOnTimeout,
      maxAttempts: requestOptions.maxAttempts,
    });
  }

  public async makeRequestWithFullUrl<T>(
    requestOptions: QualysApiMakeRequestWithFullUrlOptions<T>,
  ): Promise<QualysApiRequestResponse<T>> {
    const headers = new Headers({
      ...requestOptions.headers,
      'X-Requested-With': REQUESTED_WITH,
    });

    const authBuffer = Buffer.from(
      `${this.username}:${this.password}`,
      'ascii',
    );
    headers.append('Authorization', `Basic ${authBuffer.toString('base64')}`);

    const request = new Request(requestOptions.url, {
      method: requestOptions.method,
      headers,
      body: requestOptions.body,
    });

    const response: Response = await retry(async () => await fetch(request), {
      maxAttempts: requestOptions.maxAttempts,
      timeout: 1000 * 60 * 2,
    });

    let responseText: string | undefined;
    let responseData: T;

    if (
      (requestOptions.responseType as QualysClientResponseType<any>) ===
      QualysClientResponseType.NONE
    ) {
      responseText = undefined;
      responseData = (undefined as unknown) as T;
    } else {
      responseText = await response.text();
      if (responseText) {
        responseData = requestOptions.responseType(responseText, response);
      } else {
        responseData = (undefined as unknown) as T;
      }
    }

    const requestResponse: QualysApiRequestResponse<T> = {
      request,
      requestOptions,
      response,
      responseText,
      responseData,
    };

    if (this.onResponse) {
      this.onResponse(requestResponse);
    }

    if (!response.ok) {
      throw new QualysClientApiError({
        code: 'QUALYS_API_REQUEST_FAILED',
        message: 'Qualys API request failed',
        requestResponse,
      });
    }

    return requestResponse;
  }
}
