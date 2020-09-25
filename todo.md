Goals:

!!Increase memory/storage before running Cisco again!!

1. Break ingestion into multiple steps
2. Don't wait too long for a page of results
3. Avoid keeping much in memory
4. Collect raw data
5. Avoid duplicate \_key Error: Duplicate \_key detected (\_key=vuln-qid:150123)
   (/opt/lifeomic/app/node_modules/@jupiterone/graph-qualys/dist/collectors/QualysVulnEntityManager.js:86:48)
6. Mapped relationship for web apps

on cisco call — for the qualys finding to host mapping, let’s make sure to
include a mapping by \_class (Host) and publicIpAddress

target \_type: web_app url: <from finding, not in web app?> Finding <- HAS -
web_app

Create an Account entity Create a Service entity (IT or security control point)
Create mapped relationship to all hosts

- \_type: discovered_host
- scannedBy: 'qualys'
- lastScannedOn: 123123123
- discoveredBy: 'qualys'

Service - DISCOVERED -> Host

QualysVulnEntityManager - tracks vulns by QID, attempt to defer fetching, wants
to fetch in batches

- unfetchedQidSet = new Set<number>();
- fetchedVulnMap = new Map<number, QualysVulnerabilityEntity>();

Current single step: [ ingestWebAppsAndScans, ingestHostsAndScans]

1. collectWebApps -> { webAppScanIdSet: Set<number> } -> 2.
   collectWebAppScans(qualysVulnEntityManager, webAppScanIdSet) -> void

1. collectHostAssets -> { hostEntityLookup: Record<string,
   HostEntityLookupEntry> }
1. collectHostDetections(qualysVulnEntityManager, hostEntityLookup)

collect web apps, which produces a set of scan ids (one for each app)

- produce Application entities
- is this actually iterating scans? the scan id is used to fetch the scan

collect scans of web apps

- really, we're iterating the vulnerabilities identified by the scan of the app
- each vulnerability could be found on mulitple apps, so these are Vulnerability
  entities
- there will be a Finding entity that includes some data from the Vulnerability
- there is a relationship between the Finding IS Vulnerability

collect hosts

Realizations

- the vuln manager is trying to batch load; this can only be possible by
  deferring the load to a point after a number of vulns are identified
- the vuln manager's list of unfetched ids is modified by multiple threads
- the WAS APIs have no limits at this time according to their 3.0 docs

Ideas

- it does seem good to lazy load vulns; vuln manager needs to work with disk
  stored vuln entities
- try to fetch vulns as last step, iterating already loaded entities

Follow instructions at
https://github.com/QualysAPI/Qualys-API-Doc-Center/blob/master/Host%20List%20Detection%20API%20samples/Multithreading/multi_thread_hd.py
for collecting assets and detections efficiently.

---

(3:13:43 PM) - [job_start] - Job for integration Qualys has started. (3:13:43
PM) - [step_start] - Starting step "Collect Data"... (3:19:13 PM) -
[operation_error] - Unexpected error occurred
(errorCode="DUPLICATE_KEY_DETECTED",
errorId="f7387632-6939-4371-8a35-2dabfd75ded9", reason="Duplicate \_key detected
(\_key=vuln-qid:150081)", operationName="fetchMissingVulnerabilities") (3:19:42
PM) - [operation_error] - Unexpected error occurred
(errorCode="DUPLICATE_KEY_DETECTED",
errorId="15ad4d97-8557-4979-994a-2d62578c564c", reason="Duplicate \_key detected
(\_key=vuln-qid:150263)", operationName="fetchMissingVulnerabilities") (3:19:53
PM) - [operation_error] - Unexpected error occurred
(errorCode="DUPLICATE_KEY_DETECTED",
errorId="2529b65f-5410-494f-bfb8-d2743f34ad64", reason="Duplicate \_key detected
(\_key=vuln-qid:150263)", operationName="fetchMissingVulnerabilities") (3:20:32
PM) - [operation_error] - Unexpected error occurred
(errorCode="DUPLICATE_KEY_DETECTED",
errorId="dc1e4f3f-59d8-45f4-97ab-567a60564e9a", reason="Duplicate \_key detected
(\_key=vuln-qid:150079)", operationName="fetchMissingVulnerabilities") (3:23:43
PM) - [operation_error] - Unexpected error occurred
(errorCode="UNEXPECTED_ERROR", errorId="ea7aa1d5-2b74-4d41-a244-84ead74c797d",
reason="Unexpected error occurred executing integration! Please contact us in
Slack or at https://support.jupiterone.io if the problem continues to occur.",
operationName="collectHostAssets")
