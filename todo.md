Goals:

- ✅ Break ingestion into multiple steps.
- ✅ Adopt pattern of `iterateResources` in provider client code.
- ✅ Ensure exceptions are handled and retries performed in all APIs.
- ✅ Use rate limit response headers from VMDR API to throttle client, avoiding
  unneccessary retries.
- ✅ Add basic handling of concurrency response headers by waiting for a bit
  before retrying.
- ✅ Create an `Account` entity.
- ✅ Create a `Service` entity for VMDR, WAS, relate them to `Account`.
- ✅ Add `function` to `Service` entities.
- ✅ Create a mapped relationship
  `Service - SCANS -> {_class: 'Host', _type: 'aws_instance', _key: '<instance arn>', id: [<instanceId>, <hostAssetId>, <qwebHostId>]`
  to relate to existing entities and allow for entity adoption when the AWS
  integration runs.
- ✅ Create a mapped relationship
  `Service - SCANS -> {_class: 'Host', _type: 'discovered_host', _key: 'qualys-host:<qwebHostId>', id: [<hostAssetId>, <qwebHostId>]`
  to cause the mapper to create the entity.
- ✅ Collect raw data on `Finding` entities.
- ✅ Create direct relationship `Service - IDENTIFIED -> Finding`.
- ✅ Rely on global mapping for `Finding <- HAS - Host`. This depends on
  `Finding.targets` including `Host.id` values (hostAssetId, qwebHostId).
- ✅ Create a mapped relationship
  `Finding - IS -> {_class: 'Vulnerability', _type: 'cve', _key: '<cve.id>'` for
  each CVE in the vulnerability. This will relate the `Finding` to the global
  `cve` entities that all scanner integrations reference.
- ✅ Create a mapped relationship `Service - SCANS -> WebApp`.
- ✅ Ingest wep app `Finding`, including values in `targets` to allow global
  mappings to function.
- Enable schema validation

---

- Avoid duplicate \_key Error: Duplicate \_key detected (\_key=vuln-qid:150123)
  (/opt/lifeomic/app/node_modules/@jupiterone/graph-qualys/dist/collectors/QualysVulnEntityManager.js:86:48)

for the qualys finding to host mapping, let’s make sure to include a mapping by
\_class (Host) and publicIpAddress

target \_type: web_app url: <from finding, not in web app?> Finding <- HAS -
web_app

- \_type: discovered_host
- scannedBy: 'qualys'
- lastScannedOn: 123123123
- discoveredBy: 'qualys'

Finding should require `targets` on finding, ensure validation is enabled

collect web apps, which produces a set of scan ids (one for each app)

- produce Application entities
- is this actually iterating scans? the scan id is used to fetch the scan

collect scans of web apps

- really, we're iterating the vulnerabilities identified by the scan of the app
- each vulnerability could be found on mulitple apps, so these are Vulnerability
  entities
- there will be a Finding entity that includes some data from the Vulnerability
- there is a relationship between the Finding IS Vulnerability
