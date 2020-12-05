export * as assets from './assets';
export * as vmpc from './vmpc';
export * as was from './was';
export * as qps from './qps';
export * from './client';
export * from './util';

/**
 * VMDR module "QWEB" host IDs.
 *
 * @see https://qualys-secure.force.com/discussions/s/article/000006216 to
 * understand the difference between the three types of IDs in Qualys.
 */
export type QWebHostId = number;
