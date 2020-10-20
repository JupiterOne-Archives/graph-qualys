import collectHostAssets from '../collectors/collectHostAssets';
import collectHostDetections from '../collectors/collectHostDetections';
import collectWebAppScans from '../collectors/collectWebAppScans';
import collectWebApps from '../collectors/collectWebApps';

import collectDataStep from './collect-data';
import { IntegrationStepExecutionContext } from '@jupiterone/integration-sdk-core';
import { createMockStepExecutionContext } from '@jupiterone/integration-sdk-testing';
import { QualysIntegrationConfig } from '../types';
import { QualysClientApiError } from '../provider/errors';

jest.mock('../collectors/collectHostAssets', () => {
  return {
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('../collectors/collectHostDetections', () => {
  return {
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('../collectors/collectWebAppScans', () => {
  return {
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('../collectors/collectWebApps', () => {
  return {
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
  };
});

for (const testInput of [
  ['collectWebApps', collectWebApps],
  ['collectWebAppScans', collectWebAppScans],
  ['collectHostAssets', collectHostAssets],
  ['collectHostDetections', collectHostDetections],
]) {
  const [operationName, collectFunction] = testInput;

  test(`should publish error event if ${operationName}(...) fails`, async () => {
    delete process.env.RUNNING_TESTS;
    const context = createMockStepExecutionContext({
      instanceConfig: {
        qualysUsername: 'fake username',
        qualysPassword: 'fake password',
        qualysApiUrl: 'fake URL',
      } as QualysIntegrationConfig,
    }) as IntegrationStepExecutionContext<QualysIntegrationConfig>;

    const qualysApiError = new QualysClientApiError({
      code: 'fake error code',
      message: 'fake error message',
      requestResponse: {
        request: {
          url: 'fake url',
        } as any,
        responseText: 'fake response text',
        requestOptions: {} as any,
        response: {
          status: 404,
        } as any,
        responseData: {} as any,
      },
    });

    (collectFunction as jest.Mock).mockRejectedValue(qualysApiError);

    const publishSpy = jest
      .spyOn(context.logger, 'publishErrorEvent')
      .mockReturnValue(undefined);

    await collectDataStep.executionHandler(context);

    const expectedAdditionalData = {
      operationName,
      responseText: qualysApiError.requestResponse.responseText,
      responseStatus: qualysApiError.requestResponse.response.status,
      requestUrl: qualysApiError.requestResponse.request.url,
    };

    // expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith({
      /**
       * A name to associate with error
       */
      name: 'operation_error',

      message: 'Qualys API error occurred',

      /**
       * The raw error that occurred
       */
      err: qualysApiError,

      /**
       * Any additional data that will only be logged (not published with event)
       */
      logData: expectedAdditionalData,

      /**
       * Contents of `eventData` will be serialized and added to the description
       * property of the event but it will not be logged.
       */
      eventData: expectedAdditionalData,
    });
  });
}
