import { buildServiceRequestBody } from './util';

describe('buildServiceRequestBody', () => {
  test('no filters', () => {
    expect(buildServiceRequestBody({ limit: 1, offset: 1 }))
      .toEqual(`<ServiceRequest>
  <preferences>
    <limitResults>1</limitResults>
    <startFromOffset>1</startFromOffset>
  </preferences>
  
</ServiceRequest>`);
  });

  test('filters', () => {
    expect(
      buildServiceRequestBody({
        limit: 1,
        offset: 1,
        filters: { id: [1, 2], isScanned: false },
      }),
    ).toEqual(`<ServiceRequest>
  <preferences>
    <limitResults>1</limitResults>
    <startFromOffset>1</startFromOffset>
  </preferences>
  <filters><Criteria field="id" operator="IN">1,2</Criteria>
<Criteria field="isScanned" operator="EQUALS">false</Criteria></filters>
</ServiceRequest>`);
  });
});
