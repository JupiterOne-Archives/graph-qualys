import QualysClient, {
  buildPaginatedResponse,
  QualysApiMakeRequestWithFullUrlOptions,
  QualysApiNextRequest,
  QualysApiResponse,
  QualysApiResponsePaginator,
  QualysClientResponseType,
} from './QualysClient';

export type PaginationOptions = {
  limit: number;
  filters?: Record<string, string | boolean | number>;
};

export function buildRestApiPaginatedRequestBody(options: {
  lastId?: string;
  paginationOptions: PaginationOptions;
}): string {
  const { lastId, paginationOptions } = options;
  const { limit, filters } = paginationOptions;
  const criteriaList: string[] = [];
  if (lastId) {
    criteriaList.push(
      `<Criteria field="id" operator="GREATER">${lastId}</Criteria>`,
    );
  }

  if (filters) {
    for (const key of Object.keys(filters)) {
      criteriaList.push(
        `<Criteria field="${key}" operator="EQUALS">${filters[key]}</Criteria>`,
      );
    }
  }

  return `
<ServiceRequest>
  <preferences>
    ${limit ? `<limitResults>${limit}</limitResults>` : ''}
  </preferences>
  ${criteriaList.length ? `<filters>${criteriaList.join('')}</filters>` : ''}
</ServiceRequest>
  `;
}

export function buildRestApiNextPageRequest(options: {
  requestOptions: {
    url: string;
    headers?: Record<string, string>;
  };
  paginationOptions: PaginationOptions;
  result: QualysApiResponse<any>;
}): QualysApiNextRequest | null {
  const { requestOptions, paginationOptions, result } = options;
  const responseData: any = result.responseData;
  const hasMoreRecords = responseData.ServiceResponse?.hasMoreRecords;
  const lastId = responseData.ServiceResponse?.lastId;
  return hasMoreRecords
    ? {
        ...requestOptions,
        body: buildRestApiPaginatedRequestBody({
          paginationOptions,
          lastId,
        }),
      }
    : null;
}

export function buildRestApiPaginator<T>(
  qualysClient: QualysClient,
  options: {
    requestOptions: {
      requestName: string;
      url: string;
      headers?: Record<string, string>;
    };
    paginationOptions: PaginationOptions;
  },
): QualysApiResponsePaginator<T> {
  const { paginationOptions } = options;
  const headers = {
    ...options.requestOptions.headers,
    // always add the Content-Type header
    'Content-Type': 'text/xml',
  };

  const requestOptions: QualysApiMakeRequestWithFullUrlOptions<T> = {
    ...options.requestOptions,
    headers,
    method: 'post',
    body: buildRestApiPaginatedRequestBody({
      paginationOptions,
    }),
    responseType: QualysClientResponseType.XML as QualysClientResponseType<T>,
  };

  return buildPaginatedResponse<T>(qualysClient, {
    requestOptions,
    buildNextRequest: (result) => {
      return buildRestApiNextPageRequest({
        requestOptions,
        paginationOptions,
        result,
      });
    },
  });
}
