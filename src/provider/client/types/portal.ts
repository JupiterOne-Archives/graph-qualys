export type PortalInfo = {
  'Portal-Version': PortalVersion;
  'QWeb-Version': QWebVersion;
};

export type PortalVersion = {
  'WAS-VERSION': string;
  'VM-VERSION': string;
};

export type QWebVersion = {
  'WEB-VERSION': string;
  'SCANNER-VERSION': string;
  'VULNSIGS-VERSION': string;
};
