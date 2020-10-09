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

[1]:
  https://qualysguard.qg3.apps.qualys.com/qwebhelp/fo_portal/getting_started/resources.htm
