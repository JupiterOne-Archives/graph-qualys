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
- ✅ Create a mapped relationship `Service - MONITORS -> Host`. This will cause
  the mapper to create the Host entities and relate them to existing EC2
  instances by `instanceId` where possible. The `qualysHostId` is added to the
  `Host` to allow for mapping `Finding`s in a later step.
- ✅ Collect raw data on `Finding` entities.
- ✅ Create direct relationship `Service - IDENTIFIED -> Finding`.
- ✅ Rely on global mapping for `Finding <- HAS - Host`. This relies on
  `Finding.targets` including IP addresses and AWS instance ID values.
- Ingest `Vulnerability` entities and create `Finding - IS -> Vulnerability`
  direct relationships.
- Create mapped relationships `Vulnerability - IS -> Weakness` for CVE, other
  standards.
- Create a mapped relationship `Service - MONITORS -> WebApp`.
- Ingest wep app `Finding`, including values in `targets` to allow global
  mappings to function.

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
