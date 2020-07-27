import colors from 'colors';
import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import { Writable } from 'stream';

import { QualysApiRequestResponse } from './QualysClient';

type Formatter = (str: string) => string;

const BOLD_FORMATTER: Formatter = (str) => {
  return colors.bold(str);
};

const GRAY_FORMATTER: Formatter = (str) => {
  return colors.gray(str);
};

const CYAN_FORMATTER: Formatter = (str) => {
  return colors.cyan(str);
};

const GREEN_FORMATTER: Formatter = (str) => {
  return colors.green(str);
};

const RED_FORMATTER: Formatter = (str) => {
  return colors.red(str);
};

export class QualysHttpRecorder {
  streams: Record<string, Writable | undefined>;
  recordingDir: string;
  logToConsole: boolean;

  constructor(options: { recordingDir: string; logToConsole: boolean }) {
    this.streams = {};
    this.recordingDir = options.recordingDir;
    this.logToConsole = options.logToConsole;
  }

  static async createHttpRecordingDir(dir: string): Promise<string> {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${
      now.getMonth() + 1
    }-${now.getDate()}`;
    const subdir = path.join(dir, dateStr);

    await mkdirp(subdir);
    return subdir;
  }

  close(): void {
    for (const key of Object.keys(this.streams)) {
      this.streams[key]?.end();
    }
  }

  private getStreamForRequest(
    requestResponse: QualysApiRequestResponse<any>,
  ): Writable {
    const requestName = requestResponse.requestOptions.requestName;
    let stream = this.streams[requestName];
    if (!stream) {
      stream = this.streams[requestName] = fs.createWriteStream(
        path.join(this.recordingDir, `${requestName}.log`),
        {
          flags: 'a',
          encoding: 'utf8',
        },
      );
    }
    return stream;
  }

  private write(stream: Writable, str: string, formatter?: Formatter) {
    if (this.logToConsole) {
      process.stdout.write(formatter ? formatter(str) : str);
    }
    stream.write(str);
  }

  logRequest(requestResponse: QualysApiRequestResponse<any>): void {
    const requestMethod = requestResponse.request.method;
    const requestUrl = requestResponse.request.url;
    const requestHeaders = requestResponse.request.headers;
    const { ok, status, statusText } = requestResponse.response;
    const { responseText, responseData } = requestResponse;
    const responseHeaders = requestResponse.response.headers;

    const stream = this.getStreamForRequest(requestResponse);

    this.write(stream, '\nREQUEST:', BOLD_FORMATTER);
    this.write(
      stream,
      `\n\n${requestMethod.toUpperCase()} ${requestUrl}\n\n`,
      CYAN_FORMATTER,
    );
    for (const [headerName, headerValue] of requestHeaders) {
      this.write(stream, '  ');
      this.write(stream, headerName, BOLD_FORMATTER);
      this.write(stream, ': ', BOLD_FORMATTER);
      this.write(stream, headerValue, GRAY_FORMATTER);
      this.write(stream, '\n');
    }

    if (requestResponse.requestOptions.body) {
      this.write(stream, '\nRAW REQUEST:\n', BOLD_FORMATTER);
      this.write(stream, requestResponse.requestOptions.body, GRAY_FORMATTER);
    }

    this.write(stream, '\nRESPONSE:', BOLD_FORMATTER);

    this.write(
      stream,
      `\n\n${status} ${statusText}\n\n`,
      ok ? GREEN_FORMATTER : RED_FORMATTER,
    );

    for (const [headerName, headerValue] of responseHeaders) {
      this.write(stream, '  ');
      this.write(stream, headerName, BOLD_FORMATTER);
      this.write(stream, ': ', BOLD_FORMATTER);
      this.write(stream, headerValue, GRAY_FORMATTER);
      this.write(stream, '\n');
    }

    if (responseText) {
      this.write(stream, '\nRAW RESPONSE:\n', BOLD_FORMATTER);
      this.write(stream, responseText, GRAY_FORMATTER);
    }

    if (responseData) {
      this.write(stream, '\n\nPARSED RESPONSE:\n', BOLD_FORMATTER);
      this.write(stream, JSON.stringify(responseData, null, 2), GRAY_FORMATTER);
    }

    this.write(stream, '\n---\n');
  }
}
