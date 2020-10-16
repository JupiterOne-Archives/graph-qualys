export type ServiceResponse<DataType> = {
  responseCode?: string;
  count?: number;
  hasMoreRecords?: boolean;
  data?: DataType;
};
