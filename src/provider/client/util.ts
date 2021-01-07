import xmlParser from 'fast-xml-parser';
import { Response } from 'node-fetch';

import { IntegrationError } from '@jupiterone/integration-sdk-core';

import { PossibleArray, qps, was } from './types';

export function toArray<T>(value: PossibleArray<T> | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

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
export function isXMLResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return !!contentType && XML_CONTENT_TYPE.test(contentType);
}

/**
 * @throws IntegrationError when response Content-Type is not XML
 */
export function ensureXMLResponse(response: Response): void {
  if (!isXMLResponse(response))
    throw new IntegrationError({
      message: `Expected Content-Type to match ${XML_CONTENT_TYPE} but was ${JSON.stringify(
        response.headers.get('content-type'),
      )}`,
      code: 'UNEXPECTED_RESPONSE_CONTENT_TYPE',
      fatal: false,
    });
}

/**
 * @throws IntegrationError when response Content-Type is not XML
 */
export async function parseXMLResponse<T>(response: Response): Promise<T> {
  ensureXMLResponse(response);
  const body = await response.text();
  return xmlParser.parse(body) as T;
}

export async function processServiceResponseBody<
  T extends qps.ServiceResponseBody<any>
>(response: Response): Promise<T> {
  ensureXMLResponse(response);

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
