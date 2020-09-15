import xmlParser from 'fast-xml-parser';
import fetch, { Headers, Request, Response } from 'node-fetch';
import querystring from 'querystring';

import { retry } from '@lifeomic/attempt';

import { QualysAssetManagementClient } from './assetManagement';
import { QualysClientApiError, QualysClientError } from './errors';
import { QualysKnowledgeBaseClient } from './knowledgeBase';
import { QualysVmClient } from './vulnerabilityManagement';
import { QualysWebApplicationScanningClient } from './webApplicationScanning';

export type QualysApiRequestWithPathOptions = {
  path: string;
  method: 'get' | 'post';
  query: querystring.ParsedUrlQueryInput;
};

export type QualysApiMakeRequestWithFullUrlOptions<T> = {
  requestName: string;
  responseType: QualysClientResponseType<T>;
  headers?: Record<string, string>;
  url: string;
  method: 'get' | 'post';
  body?: string;
};

export type QualysApiMakeRequestOptions<T> = {
  requestName: string;
  responseType: QualysClientResponseType<T>;
  headers?: Record<string, string>;
  method: 'get' | 'post';
  path: string;
  query?: querystring.ParsedUrlQueryInput;
  body?: string;
};

export type QualysApiResponse<T> = {
  response: Response;
  responseData: T;
  responseText: string | undefined;
};

export type QualysApiPaginatedResponse<T> = QualysApiResponse<T> & {
  hasNextPage: boolean;
  nextPage: () => QualysApiResponse<T> | null;
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
  nextPage: () => Promise<QualysApiResponse<T>>;
};

export type QualysApiNextRequest = {
  url: string;
  headers?: Record<string, string>;
  body?: string;
};

export type BuildNextRequestFunction<T> = (
  response: QualysApiResponse<T>,
) => QualysApiNextRequest | null;

export function buildPaginatedResponse<T>(
  qualysClient: QualysClient,
  options: {
    requestOptions: QualysApiMakeRequestWithFullUrlOptions<T>;
    buildNextRequest: BuildNextRequestFunction<T>;
  },
): QualysApiResponsePaginator<T> {
  const { requestOptions, buildNextRequest } = options;

  let nextRequest: QualysApiNextRequest | null = {
    url: requestOptions.url,
    body: requestOptions.body,
    headers: requestOptions.headers,
  };

  return {
    hasNextPage: () => {
      return !!nextRequest;
    },

    nextPage: async () => {
      if (!nextRequest) {
        throw new QualysClientError({
          code: 'NO_NEXT_PAGE',
          message: '"nextPage" called but there is no next page',
        });
      }

      const result = await qualysClient.makeRequestWithFullUrl({
        requestName: requestOptions.requestName,
        responseType: requestOptions.responseType,
        method: requestOptions.method,
        url: nextRequest.url,
        headers: nextRequest.headers,
        body: nextRequest.body,
      });

      nextRequest = buildNextRequest(result);

      return result;
    },
  };
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
      timeout: 1000 * 30,
    });

    const response = await retry(async () => await fetch(request), {
      maxAttempts: 10,
      handleError: (err, context, options) => {
        if (err.name != 'FetchError') {
          throw err;
        }
      },
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
