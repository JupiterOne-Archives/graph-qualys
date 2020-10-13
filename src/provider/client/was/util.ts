import { was } from '../types';

export function buildFilterXml(
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
  return `<filters>${criteria}</filters>`;
}

export function buildServiceRequestBody({
  limit,
  offset,
  filterXml,
}: {
  limit: number;
  offset: number;
  filterXml?: string;
}): string {
  return `<ServiceRequest>
  <preferences>
    <limitResults>${limit}</limitResults>
    <startFromOffset>${offset}</startFromOffset>
  </preferences>
  ${filterXml && ''}
</ServiceRequest>`;
}
