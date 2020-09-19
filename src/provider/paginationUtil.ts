import QualysClient, {
  buildQualysClientPaginator,
  QualysApiNextRequest,
  QualysApiResponse,
  QualysApiResponsePaginator,
  QualysClientResponseType,
} from './QualysClient';
import { QualysClientError } from './errors';

export type QualysRestApiSearchConstraints = {
  filters?: Record<string, string | boolean | number | undefined>;
  dateAfterFilters?: Record<string, Date | undefined>;
};

function formatDateForQualysFilter(date: Date) {
  const dateStr = date.toISOString();
  const dotPos = dateStr.indexOf('.');
  if (dotPos === -1) {
    return dateStr;
  }

  return dateStr.substring(0, dotPos) + 'Z';
}

function buildRestApiPaginatedRequestBody(options: {
  lastId?: number;
  limit: number;
  constraints: QualysRestApiSearchConstraints;
}): string {
  const { limit, lastId, constraints } = options;
  const { filters, dateAfterFilters } = constraints;
  const criteriaList: string[] = [];

  if (dateAfterFilters) {
    for (const key of Object.keys(dateAfterFilters)) {
      const date = dateAfterFilters[key];
      if (date) {
        criteriaList.push(
          `<Criteria field="${key}" operator="GREATER">${formatDateForQualysFilter(
            date,
          )}</Criteria>`,
        );
      }
    }
  }

  if (filters) {
    for (const key of Object.keys(filters)) {
      const value = filters[key];
      if (value != null) {
        criteriaList.push(
          `<Criteria field="${key}" operator="EQUALS">${value}</Criteria>`,
        );
      }
    }
  }

  return `
<ServiceRequest>
  <preferences>
    ${lastId ? `<startFromId>${lastId + 1}</startFromId>` : ''}
    ${limit ? `<limitResults>${limit}</limitResults>` : ''}
  </preferences>
  ${criteriaList.length ? `<filters>${criteriaList.join('')}</filters>` : ''}
</ServiceRequest>
  `;
}

function parsePossibleNumber(value: any) {
  return value ? parseInt(value, 10) : undefined;
}

export function buildRestApiPaginator<T>(
  qualysClient: QualysClient,
  options: {
    requestName: string;
    url: string;
    headers?: Record<string, string>;
    limit: number;
    maxAttempts: number;
    constraints: QualysRestApiSearchConstraints;
  },
): QualysApiResponsePaginator<T> {
  const { constraints } = options;
  let limit = options.limit;
  const { maxAttempts, limitDecrease } = buildRetryOptions({
    limit,
    maxAttempts: options.maxAttempts,
  });

  const headers = {
    ...options.headers,
    // always add the Content-Type header
    'Content-Type': 'text/xml',
  };

  const url = options.url;
  let maxIdSeen = 0;

  const buildRestApiNextPageRequest = (
    lastResponse: QualysApiResponse<any> | null,
  ): QualysApiNextRequest<any> | null => {
    let cursor: string | undefined;
    let lastId: number | undefined;

    if (lastResponse) {
      const responseData: any = lastResponse.responseData;
      const hasMoreRecords = responseData.ServiceResponse?.hasMoreRecords;
      lastId = parsePossibleNumber(responseData.ServiceResponse?.lastId);
      if (!lastId || !hasMoreRecords) {
        return null;
      }

      if (lastId < maxIdSeen) {
        throw new QualysClientError({
          code: 'PAGINATION_LAST_ID_LESS_THAN_PREVIOUS_ID',
          message: '"lastId" from respone is less than a previously seen ID',
        });
      }
      maxIdSeen = lastId;
      cursor = lastId.toString();
    }

    return {
      url,
      headers,
      // cursor is for logging
      cursor,
      body: buildRestApiPaginatedRequestBody({
        limit,
        constraints,
        lastId,
      }),
      lastResponse,
      logData: {
        limit,
        constraints,
        lastId,
      },
    };
  };

  return buildQualysClientPaginator<T>(qualysClient, {
    requestName: options.requestName,
    url,
    headers,
    method: 'post',
    body: buildRestApiPaginatedRequestBody({
      limit,
      constraints,
    }),
    maxAttempts,
    logData: { limit, constraints },
    responseType: QualysClientResponseType.XML as QualysClientResponseType<T>,
    buildPageRequestToRetryAfterTimeout: (context, lastResponse) => {
      limit = Math.max(100, limit - limitDecrease);
      context.logger.warn({ limit }, 'Adjusted pagination limit after timeout');
      return buildRestApiNextPageRequest(lastResponse);
    },
    buildNextPageRequest: (context, lastResponse) => {
      return buildRestApiNextPageRequest(lastResponse);
    },
  });
}

export function buildRetryOptions(options: {
  maxAttempts: number;
  limit: number;
}): {
  maxAttempts: number;
  limit: number;
  limitDecrease: number;
} {
  const { limit, maxAttempts } = options;
  const limitDecrease = Math.round(limit / (maxAttempts + 1));
  return {
    maxAttempts,
    limit,
    limitDecrease,
  };
}
