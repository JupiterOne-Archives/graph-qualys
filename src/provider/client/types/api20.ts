import { ISODateString } from './util';

/**
 * A type representing a SIMPLE_RETURN response. Not all properties represented.
 *
 * @see https://qualysapi.qualys.com/api/2.0/simple_return.dtd
 */
export type SimpleReturn = {
  SIMPLE_RETURN?: {
    RESPONSE: {
      DATETIME: ISODateString;
      CODE: number;
      TEXT: string;
    };
  };
};
