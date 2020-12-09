import { noop } from 'lodash';
import PQueue from 'p-queue';
import sax from 'sax';

import { parseStringPropertyValue } from '@jupiterone/integration-sdk-core';

import { ResourceIteratee, vmpc } from '../types';

export type HostDetections = {
  host: vmpc.DetectionHost;
  detections: vmpc.HostDetection[];
};

export function parseHostDetectionsStream({
  xmlStream,
  iteratee,
  onIterateeError,
  iterateeErrorLimit,
  debug = false,
}: {
  xmlStream: NodeJS.ReadableStream;
  iteratee: ResourceIteratee<HostDetections>;
  onIterateeError: (err: Error, hostDetections: HostDetections) => void;

  /**
   * The number of errors to accept, from the start, before giving up. This is
   * meant to catch the situation where the iteratee is broken (such as a bad
   * converter function).
   */
  iterateeErrorLimit?: number;

  debug?: boolean;
}): Promise<void> {
  const log = debug ? console.log : noop;

  return new Promise((resolve, reject) => {
    let terminating = false;
    let iterateeErrorCount = 0;
    let iterateeSuccessCount = 0;

    const iterateeQueue = new PQueue();

    let host: any,
      detections: any[],
      detection: any,
      propertyValue: string[] | undefined;
    const propertyTargets: any[] = [];

    const saxStream = sax.createStream();

    // TODO put 2 minute onIdle socket timeout because qualys said they will
    // send something every 56 seconds to keep the connection open.
    const completePromises = async (err?: Error) => {
      log('completePromises', {
        err,
        iterateePromiseCount: iterateeQueue.size,
        terminating,
      });

      xmlStream.pause();
      xmlStream.unpipe(saxStream);

      await iterateeQueue.onIdle();
      return err ? reject(err) : resolve();
    };

    saxStream.on('close', () => {
      log('close', { terminating });
    });

    saxStream.on('error', function (err) {
      log('error', { err, terminating });
      // TODO test parsing error
    });

    saxStream.on('opentag', function (tag) {
      log('opentag', { tag, terminating });

      if (tag.name === 'HOST') {
        host = {};
        propertyTargets.unshift(host);
      } else if (tag.name === 'DETECTION_LIST') {
        detections = [];
      } else if (tag.name === 'DETECTION') {
        detection = {};
        detections.push(detection);
        propertyTargets.unshift(detection);
      } else if (propertyTargets.length > 0) {
        propertyValue = [];
      }
    });

    saxStream.on('text', function (text) {
      log('text', { text, propertyValue, terminating });

      if (propertyValue && propertyTargets.length > 0) {
        propertyValue.push(text);
      }
    });

    saxStream.on('cdata', function (cdata) {
      log('cdata', { cdata, propertyValue, terminating });

      if (propertyValue && propertyTargets.length > 0) {
        propertyValue.push(cdata);
      }
    });

    saxStream.on('closetag', function (tag) {
      log('closetag', {
        tag,
        propertyTargets,
        propertyValue,
        host,
        detections,
        terminating,
      });

      if (terminating) return;

      if (propertyValue && propertyTargets.length > 0) {
        propertyTargets[0][tag] = parseStringPropertyValue(
          propertyValue.join('').trim(),
        );
        propertyValue = undefined;
      }

      if (tag === 'DETECTION') {
        propertyTargets.shift();
      } else if (tag === 'HOST') {
        propertyTargets.shift();

        const hostDetections: HostDetections = {
          host,
          detections,
        };

        iterateeQueue
          .add(async () => {
            await iteratee(hostDetections);
            iterateeSuccessCount++;
          })
          .catch((err) => {
            iterateeErrorCount++;

            log('iterateeError', {
              err,
              iterateeErrorLimit,
              iterateeErrorCount,
              hostDetections,
              terminating,
            });

            onIterateeError(err, hostDetections);

            if (
              !iterateeSuccessCount &&
              iterateeErrorLimit &&
              iterateeErrorCount >= iterateeErrorLimit
            ) {
              terminating = true;
              completePromises(
                new Error(
                  `Exceeded iteratee error limit ${iterateeErrorLimit}`,
                ),
              );
            }
          });
      }
    });

    saxStream.on('end', function () {
      if (!terminating) completePromises();
    });

    xmlStream.pipe(saxStream);
  });
}
