import { camelCase, noop } from 'lodash';
import sax from 'sax';

import { parseStringPropertyValue } from '@jupiterone/integration-sdk-core';

import { ResourceIteratee, vmpc } from '../types';

export function parseHostDetectionsStream(
  xmlStream: NodeJS.ReadableStream,
  iteratee: ResourceIteratee<{
    host: vmpc.DetectionHost;
    detections: vmpc.HostDetection[];
  }>,
  debug: boolean = false,
): Promise<void> {
  const log = debug ? console.log : noop;

  return new Promise((resolve, reject) => {
    const iterateePromises: (void | Promise<void>)[] = [];
    const completePromises = () => {
      Promise.all(iterateePromises)
        .then(() => resolve())
        .catch(reject);
    };

    let host: any,
      detections: any[],
      detection: any,
      propertyValue: string[] | undefined;

    const propertyTargets: any[] = [];

    const saxStream = sax.createStream();

    saxStream.on('error', reject);

    saxStream.on('opentag', (tag) => {
      log(tag);

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

    saxStream.on('text', (text) => {
      log({ text, propertyValue });

      if (propertyValue && propertyTargets.length > 0) {
        propertyValue.push(text);
      }
    });

    saxStream.on('cdata', (cdata) => {
      log({ cdata, propertyValue });

      if (propertyValue && propertyTargets.length > 0) {
        propertyValue.push(cdata);
      }
    });

    saxStream.on('closetag', (tag) => {
      log({
        tag,
        propertyTargets,
        propertyValue,
      });

      if (propertyValue && propertyTargets.length > 0) {
        propertyTargets[0][camelCase(tag)] = parseStringPropertyValue(
          propertyValue.join('').trim(),
        );
        propertyValue = undefined;
      }

      if (tag === 'HOST') {
        log({
          host,
          detections,
        });

        propertyTargets.shift();

        iterateePromises.push(
          iteratee({
            host,
            detections,
          }),
        );
      } else if (tag === 'DETECTION') {
        propertyTargets.shift();
      }
    });

    saxStream.on('end', completePromises);

    xmlStream.pipe(saxStream);
  });
}
