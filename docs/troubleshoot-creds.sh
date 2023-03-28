#!/bin/bash
export QUSERNAME='QUALYS_USERNAME'
export QHOSTNAME='qualysapi.qg2.apps.qualys.com' # Ensure this is the correct endpoint

qcurl() {
  curl -v -u ${QUSERNAME} -H 'X-Requested-With: Curl' "$@"
}

qcurl "https://${QHOSTNAME}/api/2.0/fo/activity_log/?action=list&username=${QUSERNAME}&truncation_limit=1"
qcurl "https://${QHOSTNAME}/api/2.0/fo/asset/host/?action=list&details=None&truncation_limit=1"
qcurl "https://${QHOSTNAME}/api/2.0/fo/asset/host/vm/detection/?action=list&show_tags=1&show_igs=1&show_results=0&output_format=XML&truncation_limit=1"
qcurl "https://${QHOSTNAME}/api/2.0/fo/knowledge_base/vuln/?action=list&truncation_limit=1"
qcurl -d "action=list&ids=1-2" "https://${QHOSTNAME}/api/2.0/fo/knowledge_base/vuln/"
qcurl "https://${QHOSTNAME}/qps/rest/portal/version"
qcurl -H "Content-Type: text/xml" --data-binary '<ServiceRequest><preferences><limitResults>1</limitResults></preferences></ServiceRequest>' "https://${QHOSTNAME}/qps/rest/3.0/search/was/webapp"
qcurl -H "Content-Type: text/xml" --data-binary '<ServiceRequest><preferences><limitResults>1</limitResults></preferences></ServiceRequest>' "https://${QHOSTNAME}/qps/rest/3.0/search/was/finding/"
qcurl -H "Content-Type: text/xml" --data-binary '<ServiceRequest><preferences><limitResults>1</limitResults></preferences></ServiceRequest>' "https://${QHOSTNAME}/qps/rest/2.0/search/am/hostasset"
