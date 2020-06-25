import { IntegrationError } from '@jupiterone/integration-sdk-core';

import { QualysApiRequestResponse } from './QualysClient';

const QUALYS_CLIENT_API_ERROR = Symbol('QualysClientApiError');

type QualysClientErrorOptions = {
  code: string;
  message: string;
};

export class QualysClientError extends IntegrationError {
  constructor(options: QualysClientErrorOptions) {
    super(options);
  }
}

export class QualysClientLoginError extends QualysClientError {
  constructor(options: QualysClientErrorOptions) {
    super(options);
  }
}

export class QualysClientApiError extends QualysClientError {
  public requestResponse: QualysApiRequestResponse<any>;

  constructor(
    options: QualysClientErrorOptions & {
      requestResponse: QualysApiRequestResponse<any>;
    },
  ) {
    const { code, message, requestResponse } = options;
    super({
      code: code,
      message: message,
    });
    this.requestResponse = requestResponse;
  }
}

Object.defineProperty(
  QualysClientApiError.prototype,
  'QUALYS_CLIENT_API_ERROR',
  {
    value: QUALYS_CLIENT_API_ERROR,
    enumerable: false,
    writable: false,
  },
);

export function toPossibleQualysClientApiError(
  err: Error,
): QualysClientApiError | undefined {
  return (err as any).QUALYS_CLIENT_API_ERROR === QUALYS_CLIENT_API_ERROR
    ? (err as QualysClientApiError)
    : undefined;
}
