import { ListWebAppsFilters } from '../types';

export function buildFilterXml(filters: ListWebAppsFilters): string {
  const criteria = Object.entries(filters).map(
    ([name, value]) =>
      `<Criteria field="${name}" operator="EQUALS">${value}</Criteria>`,
  );
  return `<filters>${criteria}</filters>`;
}
