import csv from 'csv-parser';
import { noop, snakeCase } from 'lodash';

import { ResourceIteratee, vmpc } from '../types';

/**
 * All known detection row column names.
 */
const DETECTION_COLUMN_NAMES = [
  'Host ID',
  'IP Address',
  'Tracking Method',
  'Operating System',
  'DNS Name',
  'Netbios Name',
  'QG HostID',
  'Last Scan Datetime',
  'OS CPE',
  'Last VM Scanned Date',
  'Last VM Scanned Duration',
  'Last VM Auth Scanned Date',
  'Last VM Auth Scanned Duration',
  'Last PC Scanned Date',
  'QID',
  'Type',
  'Port',
  'Protocol',
  'FQDN',
  'SSL',
  'Instance',
  'Status',
  'Severity',
  'First Found Datetime',
  'Last Found Datetime',
  'Last Test Datetime',
  'Last Update Datetime',
  'Last Fixed Datetime',
  'Results',
  'Ignored',
  'Disabled',
  'Times Found',
  'Service',
  'Last Processed Datetime',
];

/**
 * Maps CSV column names to their XML equivalent for cases that cannot be handled
 * automatically.
 */
const DETECTION_SPECIAL_PROPERTY_MAP = {
  'Host ID': 'ID',
};

/**
 * Maps CSV column names to their XML equivalent, the names against which the
 * converters are written.
 */
export const DETECTION_COLUMN_PROPERTY_MAP = {};
DETECTION_COLUMN_NAMES.forEach((columnName) => {
  DETECTION_COLUMN_PROPERTY_MAP[columnName] =
    DETECTION_SPECIAL_PROPERTY_MAP[columnName] ||
    snakeCase(columnName).toUpperCase();
});

/**
 * Columns that represent host details. Values for these columns are included
 * only in the first detection of the list when
 * `suppress_duplicated_data_from_csv=1`
 */
const HOST_DETAILS_COLUMN_NAMES = [
  'Host ID',
  'IP Address',
  'Tracking Method',
  'Operating System',
  'DNS Name',
  'Netbios Name',
  'QG HostID',
  'Last Scan Datetime',
  'OS CPE',
  'Last VM Scanned Date',
  'Last VM Scanned Duration',
  'Last VM Auth Scanned Date',
  'Last VM Auth Scanned Duration',
  'Last PC Scanned Date',
];

export async function parseHostDetectionsCSVStream({
  csvStream,
  iteratee,
  onIterateeError,
  iterateeErrorLimit,
  debug = false,
}: {
  csvStream: NodeJS.ReadableStream;
  iteratee: ResourceIteratee<vmpc.HostDetections>;
  onIterateeError: (err: Error, hostDetections: vmpc.HostDetections) => void;

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
    const csvParser = csv({});

    const results: any[] = [];
    csvParser.on('error', (err) => {
      reject(err);
    });
    csvParser.on('data', (data) => {
      log(JSON.stringify(data, null, 2));
      results.push(data);
    });
    csvParser.on('end', () => {
      log(JSON.stringify(results, null, 2));
      resolve();
    });

    csvStream.pipe(csvParser);
  });
}
