import { URL } from 'url';

import { IntegrationValidationError } from '@jupiterone/integration-sdk-core';

export function validateApiUrl(qualysApiUrl: string) {
  try {
    new URL(qualysApiUrl);
  } catch (err) {
    throw new IntegrationValidationError('Invalid API URL: ' + qualysApiUrl);
  }

  if (!/https?:\/\/(qualysapi\.|localhost)/.test(qualysApiUrl)) {
    throw new IntegrationValidationError(
      `Invalid API URL: Please ensure you are providing the API URL specified by your Qualys platform host as seen under the "API URLs" section here: https://www.qualys.com/platform-identification/`,
    );
  }
}
