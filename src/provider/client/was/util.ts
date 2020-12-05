import xmlParser from 'fast-xml-parser';
import { Response } from 'node-fetch';

import { IntegrationError } from '@jupiterone/integration-sdk-core';

import { was } from '../types';
import { ServiceResponseBody } from '../types/qps';

export function buildServiceRequestBody({
  limit,
  offset,
  filters,
}: {
  limit: number;
  offset: number;
  filters?: was.ListWebAppsFilters | was.ListWebAppFindingsFilters;
}): string {
  const filterXml = filters ? buildFilterXml(filters) : '';
  return `<ServiceRequest>
  <preferences>
    <limitResults>${limit}</limitResults>
    <startFromOffset>${offset}</startFromOffset>
  </preferences>
  ${filterXml}
</ServiceRequest>`;
}

function buildFilterXml(
  filters: was.ListWebAppsFilters | was.ListWebAppFindingsFilters,
): string {
  const criteria = Object.entries(filters).map(([name, value]) => {
    if (Array.isArray(value)) {
      return `<Criteria field="${name}" operator="IN">${value.join(
        ',',
      )}</Criteria>`;
    } else {
      return `<Criteria field="${name}" operator="EQUALS">${value}</Criteria>`;
    }
  });
  return `<filters>${criteria.join('\n')}</filters>`;
}

const XML_CONTENT_TYPE = /(text|application)\/xml/;

export async function processServiceResponseBody<
  T extends ServiceResponseBody<any>
>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (!contentType || !XML_CONTENT_TYPE.test(contentType))
    throw new IntegrationError({
      message: `Expected Content-Type 'text/xml' but was ${JSON.stringify(
        contentType,
      )}`,
      code: String(response.status),
      fatal: false,
    });

  const bodyXML = await response.text();
  const bodyT = xmlParser.parse(bodyXML) as T;

  const responseCode = bodyT.ServiceResponse?.responseCode;
  if (!responseCode || responseCode === 'SUCCESS') return bodyT;

  throw new IntegrationError({
    message: `Unexpected responseCode in ServiceResponse: ${responseCode}`,
    code: responseCode,
    fatal: false,
  });
}
