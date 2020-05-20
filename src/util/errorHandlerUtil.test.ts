import {
  wrapMapFunctionWithInvokeSafely,
  wrapFunctionWithInvokeSafely,
  invokeSafely,
} from './errorHandlerUtil';
import { createMockStepExecutionContext } from '@jupiterone/integration-sdk/testing';

describe('error events should be published', () => {
  test('wrapMapFunctionWithInvokeSafely() should return undefined if error is thrown but publish error event', async () => {
    delete process.env.RUNNING_TESTS;
    const context = createMockStepExecutionContext({
      instanceConfig: {
        qualysUsername: 'fake username',
        qualysPassword: 'fake password',
        qualysApiUrl: 'fake URL',
      },
    });

    const fakeError = new Error('fake error');
    const operationFunc = jest.fn().mockRejectedValue(fakeError);

    const publishSpy = jest
      .spyOn(context.logger, 'publishErrorEvent')
      .mockReturnValue(undefined);

    const wrappedFunction = await wrapMapFunctionWithInvokeSafely(
      context,
      {
        operationName: 'dummy',
      },
      operationFunc,
    );

    const result = await wrappedFunction({});

    expect(result).toBe(undefined);
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith({
      name: 'operation_error',
      message: 'Unexpected error occurred',
      err: fakeError,
      logData: {
        operationName: 'dummy',
      },

      /**
       * Contents of `eventData` will be serialized and added to the description
       * property of the event but it will not be logged.
       */
      eventData: {
        operationName: 'dummy',
      },
    });
  });

  test('wrapFunctionWithInvokeSafely() should return undefined if error is thrown but publish error event', async () => {
    delete process.env.RUNNING_TESTS;
    const context = createMockStepExecutionContext({
      instanceConfig: {
        qualysUsername: 'fake username',
        qualysPassword: 'fake password',
        qualysApiUrl: 'fake URL',
      },
    });

    const fakeError = new Error('fake error');
    const operationFunc = jest.fn().mockRejectedValue(fakeError);

    const publishSpy = jest
      .spyOn(context.logger, 'publishErrorEvent')
      .mockReturnValue(undefined);

    const wrappedFunction = await wrapFunctionWithInvokeSafely(
      context,
      {
        operationName: 'dummy',
      },
      operationFunc,
    );

    const result = await wrappedFunction();

    expect(result).toBe(undefined);
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith({
      name: 'operation_error',
      message: 'Unexpected error occurred',
      err: fakeError,
      logData: {
        operationName: 'dummy',
      },

      /**
       * Contents of `eventData` will be serialized and added to the description
       * property of the event but it will not be logged.
       */
      eventData: {
        operationName: 'dummy',
      },
    });
  });

  test('invokeSafely() should return undefined if error is thrown but publish error event', async () => {
    delete process.env.RUNNING_TESTS;
    const context = createMockStepExecutionContext({
      instanceConfig: {
        qualysUsername: 'fake username',
        qualysPassword: 'fake password',
        qualysApiUrl: 'fake URL',
      },
    });

    const fakeError = new Error('fake error');
    const operationFunc = jest.fn().mockRejectedValue(fakeError);

    const publishSpy = jest
      .spyOn(context.logger, 'publishErrorEvent')
      .mockReturnValue(undefined);

    const result = await invokeSafely(
      context,
      {
        operationName: 'dummy',
      },
      operationFunc,
    );

    expect(result).toBe(undefined);
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith({
      name: 'operation_error',
      message: 'Unexpected error occurred',
      err: fakeError,
      logData: {
        operationName: 'dummy',
      },

      /**
       * Contents of `eventData` will be serialized and added to the description
       * property of the event but it will not be logged.
       */
      eventData: {
        operationName: 'dummy',
      },
    });
  });
});

describe('should not publish error event if no error is thrown', () => {
  test('wrapMapFunctionWithInvokeSafely() should return value of wrapped function call', async () => {
    delete process.env.RUNNING_TESTS;
    const context = createMockStepExecutionContext({
      instanceConfig: {
        qualysUsername: 'fake username',
        qualysPassword: 'fake password',
        qualysApiUrl: 'fake URL',
      },
    });

    const operationFunc = jest.fn().mockResolvedValue('abc');

    const publishSpy = jest
      .spyOn(context.logger, 'publishErrorEvent')
      .mockReturnValue(undefined);

    const wrappedFunction = await wrapMapFunctionWithInvokeSafely(
      context,
      {
        operationName: 'dummy',
      },
      operationFunc,
    );

    const result = await wrappedFunction({});

    expect(result).toBe('abc');
    expect(publishSpy).toHaveBeenCalledTimes(0);
  });

  test('wrapFunctionWithInvokeSafely() should return value of wrapped function call', async () => {
    delete process.env.RUNNING_TESTS;
    const context = createMockStepExecutionContext({
      instanceConfig: {
        qualysUsername: 'fake username',
        qualysPassword: 'fake password',
        qualysApiUrl: 'fake URL',
      },
    });

    const operationFunc = jest.fn().mockResolvedValue('abc');

    const publishSpy = jest
      .spyOn(context.logger, 'publishErrorEvent')
      .mockReturnValue(undefined);

    const wrappedFunction = await wrapFunctionWithInvokeSafely(
      context,
      {
        operationName: 'dummy',
      },
      operationFunc,
    );

    const result = await wrappedFunction();

    expect(result).toBe('abc');
    expect(publishSpy).toHaveBeenCalledTimes(0);
  });

  test('invokeSafely() should return value of wrapped function call', async () => {
    delete process.env.RUNNING_TESTS;
    const context = createMockStepExecutionContext({
      instanceConfig: {
        qualysUsername: 'fake username',
        qualysPassword: 'fake password',
        qualysApiUrl: 'fake URL',
      },
    });

    const operationFunc = jest.fn().mockResolvedValue('abc');

    const publishSpy = jest
      .spyOn(context.logger, 'publishErrorEvent')
      .mockReturnValue(undefined);

    const result = await invokeSafely(
      context,
      {
        operationName: 'dummy',
      },
      operationFunc,
    );

    expect(result).toBe('abc');
    expect(publishSpy).toHaveBeenCalledTimes(0);
  });
});
