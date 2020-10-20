# Qualys API

See the [Qualys Resource Guide][1] for links to the latest documentation.

There are multiple APIs, each being substantially different from one another,
though certainly having some commonality. For example, the APIs so far
implemented each support pagination, but in very different ways.

The client provides the integration a consistent interface for iterating
resources. However, the client code should be factored over time to reflect the
differences between the APIs as clearly as possible. For example, the
Vulnerabilty Mangagement API types and functions should be found apart from the
Web Application Scanning API types and functions.

| Resource            | Endpoint                               | Rate Limit |
| ------------------- | -------------------------------------- | ---------- |
| Web Apps            | `/qps/rest/3.0/search/was/webapp`      | None       |
| Web App Findings    | `/qps/rest/3.0/search/was/finding/`    | None       |
| Host IDs            | `/api/2.0/fo/asset/host/`              | Yes        |
| Host Asset Details  | `/qps/rest/2.0/search/am/hostasset`    | None       |
| Host Detections     | `/api/2.0/fo/asset/host/vm/detection/` | Yes        |
| Vuln Knowledge Base | `/api/2.0/fo/knowledge_base/vuln/`     | Yes        |

> API limits currently apply to the Qualys API for Vulnerability Management and
> Policy Compliance, not APIs for Qualys apps like CA, WAS, WAF, MD, CM, Asset
> Management and Tagging API.

Web App Scanner: `qps/rest/3.0`

- no documented rate limits
- there is a single `2.0` endpoint, which has a corresponding `3.0`, and we
  don't use it anyway) Asset Manager: only `qps/rest/2.0`
- no documented rate limits

[1]:
  https://qualysguard.qualys.com/qwebhelp/fo_portal/getting_started/resources.htm
