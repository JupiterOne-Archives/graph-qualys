import { IntegrationInstanceConfigFieldMap } from '@jupiterone/integration-sdk-core';

const instanceConfigFields: IntegrationInstanceConfigFieldMap = {
  qualysUsername: {
    type: 'string',
  },
  qualysPassword: {
    type: 'string',
    mask: true,
  },
  qualysApiUrl: {
    type: 'string',
  },
};

export default instanceConfigFields;
