import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

import { QualysIntegrationConfig } from '../types';
import {
  ClientDelayedRequestEvent,
  ClientEvents,
  ClientRequestEvent,
  ClientResponseEvent,
  QualysAPIClient,
} from './client';

export default function createQualysAPIClient(
  logger: IntegrationLogger,
  config: QualysIntegrationConfig,
) {
  const qualysAPI = new QualysAPIClient({
    config,
  });

  qualysAPI.events.on(
    ClientEvents.DELAYED_REQUEST,
    (event: ClientDelayedRequestEvent) => {
      logger.info(event, 'Delaying Qualys API request...');
    },
  );

  qualysAPI.events.on(ClientEvents.REQUEST, (event: ClientRequestEvent) => {
    logger.info(event, 'Sending Qualys API request...');
  });

  qualysAPI.events.on(ClientEvents.RESPONSE, (event: ClientResponseEvent) => {
    logger.info(event, 'Received Qualys API response.');
  });

  return qualysAPI;
}
