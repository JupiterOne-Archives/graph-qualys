import { was } from '../types';

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
      if (name.includes('last')) {
        // If a 'last' date filter, the operator should be GREATER
        return `<Criteria field="${name}" operator="GREATER">${value}</Criteria>`;
      }
      return `<Criteria field="${name}" operator="EQUALS">${value}</Criteria>`;
    }
  });
  return `<filters>${criteria.join('\n')}</filters>`;
}
