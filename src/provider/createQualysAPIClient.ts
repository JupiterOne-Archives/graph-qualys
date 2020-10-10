import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

import { QualysIntegrationConfig } from '../types';
import { QualysAPIClient } from './client';

export default function createQualysAPIClient(
  logger: IntegrationLogger,
  config: QualysIntegrationConfig,
) {
  const qualysAPI = new QualysAPIClient({
    config,
  });

  qualysAPI.onRequest((event) => {
    logger.info(event, 'Sending Qualys API request...');
  });

  qualysAPI.onDelayedRequest((event) => {
    logger.info(event, 'Delaying Qualys API request...');
  });

  qualysAPI.onResponse((event) => {
    logger.info(event, 'Received Qualys API response.');
  });

  return qualysAPI;
}
