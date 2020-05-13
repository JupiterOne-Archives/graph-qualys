import { IntegrationInstanceConfigFieldMap } from '@jupiterone/integration-sdk';

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
