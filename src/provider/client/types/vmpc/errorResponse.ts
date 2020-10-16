import { ISODateString } from '../util';

export type QualysV2ApiErrorResponse = {
  SIMPLE_RETURN?: {
    RESPONSE: {
      DATETIME: ISODateString;
      CODE: number;
      TEXT: string;
    };
  };
};
