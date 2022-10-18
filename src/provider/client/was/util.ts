import { was } from '../types';

export function buildSearchReportRequestBody({
  reportId,
}: {
  reportId: number;
}): string {
  return `<ServiceRequest>
    <filters>
    <Criteria field="id" operator="EQUALS">${reportId}</Criteria>
    </filters>
  </ServiceRequest>`;
}

export function buildScanReportRequestBody({
  wasScanId,
}: {
  wasScanId: number;
}): string {
  return `<ServiceRequest>
  <data>
    <Report>
      <name><![CDATA[with all parameters]]></name>
      <description><![CDATA[A simple scan report]]></description>
      <format>XML</format>
      <type>WAS_SCAN_REPORT</type>
      <config>
        <scanReport>
          <target>
            <scans>
              <WasScan>
                <id>${wasScanId}</id>
              </WasScan>
            </scans>
          </target>
          <display>
            <contents>
              <ScanReportContent>DESCRIPTION</ScanReportContent>
              <ScanReportContent>SUMMARY</ScanReportContent>
              <ScanReportContent>GRAPHS</ScanReportContent>
              <ScanReportContent>RESULTS</ScanReportContent>
              <ScanReportContent>INDIVIDUAL_RECORDS</ScanReportContent>
              <ScanReportContent>RECORD_DETAILS</ScanReportContent>
              <ScanReportContent>ALL_RESULTS</ScanReportContent>
              <ScanReportContent>APPENDIX</ScanReportContent>
            </contents>
            <graphs>
              <ScanReportGraph>VULNERABILITIES_BY_SEVERITY</ScanReportGraph>
              <ScanReportGraph>VULNERABILITIES_BY_GROUP</ScanReportGraph>
              <ScanReportGraph>VULNERABILITIES_BY_OWASP</ScanReportGraph>
              <ScanReportGraph>VULNERABILITIES_BY_WASC</ScanReportGraph>
              <ScanReportGraph>SENSITIVE_CONTENTS_BY_GROUP</ScanReportGraph>
            </graphs>
            <groups>
              <ScanReportGroup>URL</ScanReportGroup>
              <ScanReportGroup>GROUP</ScanReportGroup>
              <ScanReportGroup>OWASP</ScanReportGroup>
              <ScanReportGroup>WASC</ScanReportGroup>
              <ScanReportGroup>STATUS</ScanReportGroup>
              <ScanReportGroup>CATEGORY</ScanReportGroup>
              <ScanReportGroup>QID</ScanReportGroup>
            </groups>
            <options>
              <rawLevels>true</rawLevels>
            </options>
          </display>
          <filters>
            <status>
              <ScanFindingStatus>NEW</ScanFindingStatus>
              <ScanFindingStatus>ACTIVE</ScanFindingStatus>
              <ScanFindingStatus>REOPENED</ScanFindingStatus>
              <ScanFindingStatus>FIXED</ScanFindingStatus>
            </status>
          </filters>
        </scanReport>
      </config>
    </Report>
  </data>
</ServiceRequest>`;
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
      if (name.includes('last')) {
        // If a 'last' date filter, the operator should be GREATER
        return `<Criteria field="${name}" operator="GREATER">${value}</Criteria>`;
      }
      return `<Criteria field="${name}" operator="EQUALS">${value}</Criteria>`;
    }
  });
  return `<filters>${criteria.join('\n')}</filters>`;
}
