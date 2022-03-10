export * as assets from './assets';
export * as vmpc from './vmpc';
export * as was from './was';
export * as qps from './qps';
export * from './api20';
export * from './portal';
export * from './client';
export * from './util';

/**
 * Host ID tracking in VMDR module ("QWEB").
 *
 * @see https://qualys-secure.force.com/discussions/s/article/000006216 to
 * understand the difference between the four types of IDs in Qualys.
 */
export type QWebHostId = number;

/**
 * Host ID tracking in products other than VM or PC.
 *
 * @see https://qualys-secure.force.com/discussions/s/article/000006216 to
 * understand the difference between the four types of IDs in Qualys.
 */
export type AssetHostId = number;

/**
 * Host ID GUID
 *
 * > There is also the similarly named but quite different Qualys Host ID. This is
 * > sometimes referred to as the QG Host ID or Agentless Tracking GUID.  This is
 * > a GUID format ID found on assets that have either the Cloud Agent installed
 * > or have been scanned with an authenticated scan and Agentless Tracking
 * > enabled. Note the difference, the Qualys Host ID GUID represents hosts, and
 * > there will be a maximum of one Qualys Host ID for any host in the network,
 * > regardless of the number of interfaces it has. The Host ID discussed above
 * > represents scanned assets, so a single host with 5 scanned interfaces will be
 * > represented by five entries in the Qualys asset database, each with a unique
 * > ID, but only one Qualys Host ID if and only if it has an Agent or has been
 * > scanned with authentication and Agentless Tracking enabled.
 *
 * @see https://qualys-secure.force.com/discussions/s/article/000006216 to
 * understand the difference between the four types of IDs in Qualys.
 */
export type QGHostId = string;
