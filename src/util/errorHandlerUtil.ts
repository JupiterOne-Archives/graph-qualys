import { IntegrationStepExecutionContext } from '@jupiterone/integration-sdk-core';
import { toPossibleQualysClientApiError } from '../provider/errors';

export type ErrorLogData = {
  operationName: string;
  [k: string]: any;
};
function handleError(
  context: IntegrationStepExecutionContext,
  options: {
    err: Error;
    logData: ErrorLogData;
  },
) {
  const { err, logData } = options;
  const additionalData: Record<string, any> = {
    ...logData,
  };

  const qualysApiError = toPossibleQualysClientApiError(err);
  if (qualysApiError) {
    additionalData.responseText = qualysApiError.requestResponse.responseText;
    additionalData.responseStatus =
      qualysApiError.requestResponse.response.status;
    additionalData.requestUrl = qualysApiError.requestResponse.request.url;
  }

  context.logger.publishErrorEvent({
    name: 'operation_error',
    message: qualysApiError
      ? 'Qualys API error occurred'
      : 'Unexpected error occurred',
    err,

    // Log the additional data
    logData: additionalData,

    // Include additional data in error event that is published
    eventData: additionalData,
  });

  if (process.env.RUNNING_TESTS) {
    throw err;
  }
}

export function wrapMapFunctionWithInvokeSafely<I, O>(
  context: IntegrationStepExecutionContext,
  options: {
    operationName: string;
  },
  func: (input: I) => Promise<O>,
) {
  return async function (input: I): Promise<O | undefined> {
    try {
      return await func(input);
    } catch (err) {
      handleError(context, {
        err,
        logData: {
          operationName: options.operationName,
        },
      });
      return undefined;
    }
  };
}

export function wrapFunctionWithInvokeSafely<I, O>(
  context: IntegrationStepExecutionContext,
  options: {
    operationName: string;
  },
  func: () => Promise<O>,
) {
  return async function (): Promise<O | undefined> {
    try {
      return await func();
    } catch (err) {
      handleError(context, {
        err,
        logData: {
          operationName: options.operationName,
        },
      });
      return undefined;
    }
  };
}

export async function invokeSafely<O>(
  context: IntegrationStepExecutionContext,
  options: {
    operationName: string;
  },
  func: () => Promise<O>,
): Promise<O | undefined> {
  try {
    return await func();
  } catch (err) {
    handleError(context, {
      err,
      logData: {
        operationName: options.operationName,
      },
    });
  }
}
