import { IntegrationExecutionContext } from '@jupiterone/integration-sdk';
import { URL } from 'url';

const REQUIRED_PROPERTIES = [
  'qualysUsername',
  'qualysPassword',
  'qualysApiUrl',
];

export default async function validateInvocation(
  context: IntegrationExecutionContext,
) {
  context.logger.info(
    {
      instance: context.instance,
    },
    'Validating integration config...',
  );

  const config = context.instance.config;

  for (const key of REQUIRED_PROPERTIES) {
    if (!config[key]) {
      throw new Error('Missing required config property: ' + key);
    }
  }

  try {
    new URL(config.qualysApiUrl);
  } catch (err) {
    throw new Error('Invalid API URL: ' + config.qualysApiUrl);
  }
}
