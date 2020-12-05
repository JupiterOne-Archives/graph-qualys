/**
 * The XML response body for requests made to /qps/rest/[23].0/*.
 */
export interface ServiceResponseBody<DataType> {
  ServiceResponse?: ServiceResponse<DataType>;
}

export type ServiceResponse<DataType> = {
  responseCode?: string;

  /**
   * Details about responses having a `responseCode` that represents an error.
   * This may not be answered by some endpoints.
   */
  responseErrorDetails?: string;

  count?: number;
  hasMoreRecords?: boolean;
  data?: DataType;
};
