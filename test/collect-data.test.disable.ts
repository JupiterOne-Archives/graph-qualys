import {
  createMockStepExecutionContext,
  Recording,
  setupRecording,
} from '@jupiterone/integration-sdk-testing';
import collectDataStep from '../src/steps/collect-data';
import {
  TYPE_QUALYS_WEB_APP,
  TYPE_QUALYS_WEB_APP_FINDING,
  TYPE_QUALYS_HOST,
  ENTITY_TYPE_HOST_FINDING,
  TYPE_QUALYS_VULN,
} from '../src/converters';
import { IntegrationStepExecutionContext } from '@jupiterone/integration-sdk-core';
import { QualysIntegrationConfig } from '../src/types';

jest.setTimeout(60000);

let recording: Recording | undefined;

afterEach(async () => {
  await recording?.stop();
  recording = undefined;
});

test('should be able to collect all data', async () => {
  recording = setupRecording({
    name: 'collect-data',
    directory: __dirname,
    redactedRequestHeaders: ['authorization'],
    options: {
      // mode: 'replay',
      // recordIfMissing: false,
      recordFailedRequests: true,
      matchRequestsBy: {
        method: true,
        body: true,
        headers: false,
        order: false,
        url: {
          pathname: true,
          query: true,
          username: false,
          password: false,
          port: false,
          protocol: false,
          hostname: false,
        },
      },
    },
  });

  const context = createMockStepExecutionContext<QualysIntegrationConfig>({
    entities: [],
    relationships: [],
    instanceConfig: {
      qualysApiUrl: 'https://BLAH.qg3.apps.qualys.com',
      qualysPassword: 'password',
      qualysUsername: 'username',
    },
  }) as IntegrationStepExecutionContext<QualysIntegrationConfig>;

  await collectDataStep.executionHandler(context);

  //////////////////////////////////////////////////////////////////////////////

  const webAppDisplayNames: string[] = [];

  await context.jobState.iterateEntities(
    {
      _type: TYPE_QUALYS_WEB_APP,
    },
    (entity) => {
      webAppDisplayNames.push(entity.displayName!);
    },
  );

  webAppDisplayNames.sort();

  expect(webAppDisplayNames).toEqual([
    'First Web App - Bodgeit Store',
    'Second Web App - BoQ',
    'apps.dev.jupiterone.io',
  ]);

  //////////////////////////////////////////////////////////////////////////////

  const webAppFindingKeys: string[] = [];
  await context.jobState.iterateEntities(
    {
      _type: TYPE_QUALYS_WEB_APP_FINDING,
    },
    (entity) => {
      webAppFindingKeys.push(entity._key);
    },
  );

  webAppFindingKeys.sort();

  expect(webAppFindingKeys).toEqual([
    'param:JSESSIONID|qid:150123|title:Cookie Does Not Contain The "HTTPOnly" Attribute|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
    'param:JSESSIONID|qid:150159|title:Session Cookie Set over Non-HTTPS Connection|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
    'param:b_id|qid:150123|title:Cookie Does Not Contain The "HTTPOnly" Attribute|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'param:password|qid:150012|title:Blind SQL Injection|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'param:productid|qid:150012|title:Blind SQL Injection|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'param:quantity_10|qid:150022|title:Verbose Error Message|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'param:q|qid:150001|title:Reflected Cross-Site Scripting (XSS) Vulnerabilities|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%2Fscript%3E%3Cscript%3Efunction()%7bqxss%7d%3B%3C%2Fscript%3E|webAppId:62249034',
    'param:q|qid:150013|title:Browser-Specific Cross-Site Scripting (XSS) Vulnerabilities|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3Cscript%20src%3Dhttp%3A%2F%2Flocalhost%2Fj%20|webAppId:62249034',
    'param:q|qid:150084|title:Unencoded characters|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%0a%0dscript%20a%3D4%3Eqss%3D7%3C%0a%0d%2Fscript%3E|webAppId:62249034',
    'param:username|qid:150012|title:Blind SQL Injection|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'qid:150053|title:Login Form Is Not Submitted Via HTTPS|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'qid:150079|title:Slow HTTP headers vulnerability|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/about.jsp|webAppId:62249034',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|webAppId:62249034',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/home.jsp|webAppId:62249034',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|webAppId:62249034',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/search.jsp|webAppId:62249034',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
    'qid:150085|title:Slow HTTP POST vulnerability|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034',
    'qid:150085|title:Slow HTTP POST vulnerability|uri:https://api.dev.jupiterone.io/|webAppId:61890472',
    'qid:150112|title:Sensitive form field has not disabled autocomplete|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'qid:150112|title:Sensitive form field has not disabled autocomplete|uri:http://54.173.177.208:8080/bodgeit/register.jsp|webAppId:62249034',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/about.jsp|webAppId:62249034',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|webAppId:62249034',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/home.jsp|webAppId:62249034',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|webAppId:62249034',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/search.jsp|webAppId:62249034',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
    'qid:150150|title:HTML form containing password field(s) is served over HTTP|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'qid:150150|title:HTML form containing password field(s) is served over HTTP|uri:http://54.173.177.208:8080/bodgeit/register.jsp|webAppId:62249034',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/about.jsp|webAppId:62249034',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|webAppId:62249034',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/home.jsp|webAppId:62249034',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/search.jsp|webAppId:62249034',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
    'qid:150263|title:Insecure Transport|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
  ]);

  //////////////////////////////////////////////////////////////////////////////

  const hostDisplayNames: string[] = [];

  await context.jobState.iterateEntities(
    {
      _type: TYPE_QUALYS_HOST,
    },
    (entity) => {
      hostDisplayNames.push(entity.displayName!);
    },
  );

  hostDisplayNames.sort();

  expect(hostDisplayNames).toEqual([
    'ip-10-55-26-62.ec2.internal',
    'ip-10-55-46-210.ec2.internal',
  ]);

  //////////////////////////////////////////////////////////////////////////////

  const hostFindingKeys: string[] = [];
  await context.jobState.iterateEntities(
    {
      _type: ENTITY_TYPE_HOST_FINDING,
    },
    (entity) => {
      hostFindingKeys.push(entity._key);
    },
  );

  hostFindingKeys.sort();

  expect(hostFindingKeys).toEqual([
    'hostId:92661485|port:22|protocol:tcp|qid:38739|ssl:0',
    'hostId:92661485|qid:11|ssl:0',
    'hostId:92662027|port:22|protocol:tcp|qid:38739|ssl:0',
    'hostId:92662027|port:443|protocol:tcp|qid:11827|ssl:0',
    'hostId:92662027|port:443|protocol:tcp|qid:38170|ssl:1',
    'hostId:92662027|port:443|protocol:tcp|qid:38174|ssl:1',
    'hostId:93010479|qid:197595|ssl:0',
    'hostId:93010479|qid:197617|ssl:0',
    'hostId:93010479|qid:197652|ssl:0',
    'hostId:93010480|qid:197595|ssl:0',
    'hostId:93010480|qid:197617|ssl:0',
    'hostId:93010480|qid:197652|ssl:0',
    'hostId:93011161|qid:197146|ssl:0',
    'hostId:93011161|qid:197234|ssl:0',
    'hostId:93011161|qid:197236|ssl:0',
    'hostId:93011161|qid:197246|ssl:0',
    'hostId:93011161|qid:197291|ssl:0',
    'hostId:93011161|qid:197301|ssl:0',
    'hostId:93011161|qid:197339|ssl:0',
    'hostId:93011161|qid:197347|ssl:0',
    'hostId:93011161|qid:197371|ssl:0',
    'hostId:93011161|qid:197375|ssl:0',
    'hostId:93011161|qid:197401|ssl:0',
    'hostId:93011161|qid:197424|ssl:0',
    'hostId:93011161|qid:197553|ssl:0',
    'hostId:93011161|qid:197599|ssl:0',
    'hostId:93011161|qid:197608|ssl:0',
    'hostId:93011161|qid:197760|ssl:0',
    'hostId:93011161|qid:197784|ssl:0',
  ]);

  //////////////////////////////////////////////////////////////////////////////

  const qidList: number[] = [];

  await context.jobState.iterateEntities(
    {
      _type: TYPE_QUALYS_VULN,
    },
    (entity) => {
      qidList.push(entity.qid as number);
    },
  );

  qidList.sort();

  expect(qidList).toEqual([
    11,
    11827,
    150001,
    150012,
    150013,
    150022,
    150053,
    150079,
    150081,
    150084,
    150085,
    150112,
    150123,
    150124,
    150150,
    150159,
    150246,
    150263,
    197146,
    197234,
    197236,
    197246,
    197291,
    197301,
    197339,
    197347,
    197371,
    197375,
    197401,
    197424,
    197553,
    197595,
    197599,
    197608,
    197617,
    197652,
    197760,
    197784,
    38170,
    38174,
    38739,
  ]);

  //////////////////////////////////////////////////////////////////////////////

  const hostHasFindingKeys: string[] = [];

  await context.jobState.iterateRelationships(
    {
      _type: 'qualys_host_has_finding',
    },
    (relationship) => {
      hostHasFindingKeys.push(relationship._key as string);
    },
  );

  hostHasFindingKeys.sort();

  expect(hostHasFindingKeys).toEqual([
    'qualys-host:92661485|has|hostId:92661485|port:22|protocol:tcp|qid:38739|ssl:0',
    'qualys-host:92661485|has|hostId:92661485|qid:11|ssl:0',
    'qualys-host:92662027|has|hostId:92662027|port:22|protocol:tcp|qid:38739|ssl:0',
    'qualys-host:92662027|has|hostId:92662027|port:443|protocol:tcp|qid:11827|ssl:0',
    'qualys-host:92662027|has|hostId:92662027|port:443|protocol:tcp|qid:38170|ssl:1',
    'qualys-host:92662027|has|hostId:92662027|port:443|protocol:tcp|qid:38174|ssl:1',
  ]);

  //////////////////////////////////////////////////////////////////////////////

  const hostFindingIsVulnKeys: string[] = [];

  await context.jobState.iterateRelationships(
    {
      _type: 'qualys_host_finding_is_vuln',
    },
    (relationship) => {
      hostFindingIsVulnKeys.push(relationship._key as string);
    },
  );

  hostFindingIsVulnKeys.sort();

  expect(hostFindingIsVulnKeys).toEqual([
    'hostId:92661485|port:22|protocol:tcp|qid:38739|ssl:0|is|vuln-qid:38739',
    'hostId:92661485|qid:11|ssl:0|is|vuln-qid:11',
    'hostId:92662027|port:22|protocol:tcp|qid:38739|ssl:0|is|vuln-qid:38739',
    'hostId:92662027|port:443|protocol:tcp|qid:11827|ssl:0|is|vuln-qid:11827',
    'hostId:92662027|port:443|protocol:tcp|qid:38170|ssl:1|is|vuln-qid:38170',
    'hostId:92662027|port:443|protocol:tcp|qid:38174|ssl:1|is|vuln-qid:38174',
    'hostId:93010479|qid:197595|ssl:0|is|vuln-qid:197595',
    'hostId:93010479|qid:197617|ssl:0|is|vuln-qid:197617',
    'hostId:93010479|qid:197652|ssl:0|is|vuln-qid:197652',
    'hostId:93010480|qid:197595|ssl:0|is|vuln-qid:197595',
    'hostId:93010480|qid:197617|ssl:0|is|vuln-qid:197617',
    'hostId:93010480|qid:197652|ssl:0|is|vuln-qid:197652',
    'hostId:93011161|qid:197146|ssl:0|is|vuln-qid:197146',
    'hostId:93011161|qid:197234|ssl:0|is|vuln-qid:197234',
    'hostId:93011161|qid:197236|ssl:0|is|vuln-qid:197236',
    'hostId:93011161|qid:197246|ssl:0|is|vuln-qid:197246',
    'hostId:93011161|qid:197291|ssl:0|is|vuln-qid:197291',
    'hostId:93011161|qid:197301|ssl:0|is|vuln-qid:197301',
    'hostId:93011161|qid:197339|ssl:0|is|vuln-qid:197339',
    'hostId:93011161|qid:197347|ssl:0|is|vuln-qid:197347',
    'hostId:93011161|qid:197371|ssl:0|is|vuln-qid:197371',
    'hostId:93011161|qid:197375|ssl:0|is|vuln-qid:197375',
    'hostId:93011161|qid:197401|ssl:0|is|vuln-qid:197401',
    'hostId:93011161|qid:197424|ssl:0|is|vuln-qid:197424',
    'hostId:93011161|qid:197553|ssl:0|is|vuln-qid:197553',
    'hostId:93011161|qid:197599|ssl:0|is|vuln-qid:197599',
    'hostId:93011161|qid:197608|ssl:0|is|vuln-qid:197608',
    'hostId:93011161|qid:197760|ssl:0|is|vuln-qid:197760',
    'hostId:93011161|qid:197784|ssl:0|is|vuln-qid:197784',
  ]);

  //////////////////////////////////////////////////////////////////////////////

  const webAppHasFindingKeys: string[] = [];

  await context.jobState.iterateRelationships(
    {
      _type: 'qualys_web_app_has_finding',
    },
    (relationship) => {
      webAppHasFindingKeys.push(relationship._key as string);
    },
  );

  webAppHasFindingKeys.sort();

  expect(webAppHasFindingKeys).toEqual([
    'web_app:61890472|has|qid:150085|title:Slow HTTP POST vulnerability|uri:https://api.dev.jupiterone.io/|webAppId:61890472',
    'web_app:62249034|has|param:JSESSIONID|qid:150123|title:Cookie Does Not Contain The "HTTPOnly" Attribute|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
    'web_app:62249034|has|param:JSESSIONID|qid:150159|title:Session Cookie Set over Non-HTTPS Connection|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
    'web_app:62249034|has|param:b_id|qid:150123|title:Cookie Does Not Contain The "HTTPOnly" Attribute|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'web_app:62249034|has|param:password|qid:150012|title:Blind SQL Injection|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'web_app:62249034|has|param:productid|qid:150012|title:Blind SQL Injection|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'web_app:62249034|has|param:quantity_10|qid:150022|title:Verbose Error Message|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'web_app:62249034|has|param:q|qid:150001|title:Reflected Cross-Site Scripting (XSS) Vulnerabilities|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%2Fscript%3E%3Cscript%3Efunction()%7bqxss%7d%3B%3C%2Fscript%3E|webAppId:62249034',
    'web_app:62249034|has|param:q|qid:150013|title:Browser-Specific Cross-Site Scripting (XSS) Vulnerabilities|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3Cscript%20src%3Dhttp%3A%2F%2Flocalhost%2Fj%20|webAppId:62249034',
    'web_app:62249034|has|param:q|qid:150084|title:Unencoded characters|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%0a%0dscript%20a%3D4%3Eqss%3D7%3C%0a%0d%2Fscript%3E|webAppId:62249034',
    'web_app:62249034|has|param:username|qid:150012|title:Blind SQL Injection|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150053|title:Login Form Is Not Submitted Via HTTPS|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150079|title:Slow HTTP headers vulnerability|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/about.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/home.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|webAppId:62249034',
    'web_app:62249034|has|qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/search.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
    'web_app:62249034|has|qid:150085|title:Slow HTTP POST vulnerability|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150112|title:Sensitive form field has not disabled autocomplete|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150112|title:Sensitive form field has not disabled autocomplete|uri:http://54.173.177.208:8080/bodgeit/register.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/about.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/home.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|webAppId:62249034',
    'web_app:62249034|has|qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/search.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
    'web_app:62249034|has|qid:150150|title:HTML form containing password field(s) is served over HTTP|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150150|title:HTML form containing password field(s) is served over HTTP|uri:http://54.173.177.208:8080/bodgeit/register.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/about.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/home.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/search.jsp|webAppId:62249034',
    'web_app:62249034|has|qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
    'web_app:62249034|has|qid:150263|title:Insecure Transport|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034',
  ]);

  //////////////////////////////////////////////////////////////////////////////

  const webAppfindingIsVulnKeys: string[] = [];

  await context.jobState.iterateRelationships(
    {
      _type: 'qualys_web_app_finding_is_vuln',
    },
    (relationship) => {
      webAppfindingIsVulnKeys.push(relationship._key as string);
    },
  );

  webAppfindingIsVulnKeys.sort();

  expect(webAppfindingIsVulnKeys).toEqual([
    'param:JSESSIONID|qid:150123|title:Cookie Does Not Contain The "HTTPOnly" Attribute|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034|is|vuln-qid:150123',
    'param:JSESSIONID|qid:150159|title:Session Cookie Set over Non-HTTPS Connection|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034|is|vuln-qid:150159',
    'param:b_id|qid:150123|title:Cookie Does Not Contain The "HTTPOnly" Attribute|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034|is|vuln-qid:150123',
    'param:password|qid:150012|title:Blind SQL Injection|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034|is|vuln-qid:150012',
    'param:productid|qid:150012|title:Blind SQL Injection|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034|is|vuln-qid:150012',
    'param:quantity_10|qid:150022|title:Verbose Error Message|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034|is|vuln-qid:150022',
    'param:q|qid:150001|title:Reflected Cross-Site Scripting (XSS) Vulnerabilities|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%2Fscript%3E%3Cscript%3Efunction()%7bqxss%7d%3B%3C%2Fscript%3E|webAppId:62249034|is|vuln-qid:150001',
    'param:q|qid:150013|title:Browser-Specific Cross-Site Scripting (XSS) Vulnerabilities|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3Cscript%20src%3Dhttp%3A%2F%2Flocalhost%2Fj%20|webAppId:62249034|is|vuln-qid:150013',
    'param:q|qid:150084|title:Unencoded characters|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%0a%0dscript%20a%3D4%3Eqss%3D7%3C%0a%0d%2Fscript%3E|webAppId:62249034|is|vuln-qid:150084',
    'param:username|qid:150012|title:Blind SQL Injection|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034|is|vuln-qid:150012',
    'qid:150053|title:Login Form Is Not Submitted Via HTTPS|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034|is|vuln-qid:150053',
    'qid:150079|title:Slow HTTP headers vulnerability|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034|is|vuln-qid:150079',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/about.jsp|webAppId:62249034|is|vuln-qid:150081',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|webAppId:62249034|is|vuln-qid:150081',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034|is|vuln-qid:150081',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034|is|vuln-qid:150081',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/home.jsp|webAppId:62249034|is|vuln-qid:150081',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034|is|vuln-qid:150081',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|webAppId:62249034|is|vuln-qid:150081',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/search.jsp|webAppId:62249034|is|vuln-qid:150081',
    'qid:150081|title:X-Frame-Options header is not set|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034|is|vuln-qid:150081',
    'qid:150085|title:Slow HTTP POST vulnerability|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034|is|vuln-qid:150085',
    'qid:150085|title:Slow HTTP POST vulnerability|uri:https://api.dev.jupiterone.io/|webAppId:61890472|is|vuln-qid:150085',
    'qid:150112|title:Sensitive form field has not disabled autocomplete|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034|is|vuln-qid:150112',
    'qid:150112|title:Sensitive form field has not disabled autocomplete|uri:http://54.173.177.208:8080/bodgeit/register.jsp|webAppId:62249034|is|vuln-qid:150112',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/about.jsp|webAppId:62249034|is|vuln-qid:150124',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|webAppId:62249034|is|vuln-qid:150124',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034|is|vuln-qid:150124',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034|is|vuln-qid:150124',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/home.jsp|webAppId:62249034|is|vuln-qid:150124',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034|is|vuln-qid:150124',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|webAppId:62249034|is|vuln-qid:150124',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/search.jsp|webAppId:62249034|is|vuln-qid:150124',
    'qid:150124|title:Clickjacking - Framable Page|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034|is|vuln-qid:150124',
    'qid:150150|title:HTML form containing password field(s) is served over HTTP|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034|is|vuln-qid:150150',
    'qid:150150|title:HTML form containing password field(s) is served over HTTP|uri:http://54.173.177.208:8080/bodgeit/register.jsp|webAppId:62249034|is|vuln-qid:150150',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/about.jsp|webAppId:62249034|is|vuln-qid:150246',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|webAppId:62249034|is|vuln-qid:150246',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|webAppId:62249034|is|vuln-qid:150246',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|webAppId:62249034|is|vuln-qid:150246',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/home.jsp|webAppId:62249034|is|vuln-qid:150246',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/login.jsp|webAppId:62249034|is|vuln-qid:150246',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/search.jsp|webAppId:62249034|is|vuln-qid:150246',
    'qid:150246|title:Path-relative stylesheet import (PRSSI) vulnerability|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034|is|vuln-qid:150246',
    'qid:150263|title:Insecure Transport|uri:http://54.173.177.208:8080/bodgeit/|webAppId:62249034|is|vuln-qid:150263',
  ]);

  //////////////////////////////////////////////////////////////////////////////

  const ec2InstanceHasFindingKeys: string[] = [];

  await context.jobState.iterateRelationships(
    {
      _type: 'mapping_source_has_aws_instance',
    },
    (relationship) => {
      ec2InstanceHasFindingKeys.push(relationship._key as string);
    },
  );

  ec2InstanceHasFindingKeys.sort();

  expect(ec2InstanceHasFindingKeys).toEqual([
    'hostId:93010479|qid:197595|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0359e3c54d4e8b8b3',
    'hostId:93010479|qid:197617|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0359e3c54d4e8b8b3',
    'hostId:93010479|qid:197652|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0359e3c54d4e8b8b3',
    'hostId:93010480|qid:197595|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0b1efb981b7412855',
    'hostId:93010480|qid:197617|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0b1efb981b7412855',
    'hostId:93010480|qid:197652|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0b1efb981b7412855',
    'hostId:93011161|qid:197146|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197234|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197236|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197246|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197291|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197301|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197339|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197347|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197371|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197375|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197401|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197424|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197553|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197599|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197608|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197760|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
    'hostId:93011161|qid:197784|ssl:0|has|FORWARD:_type=aws_instance:instanceId=i-0a04bac6b7008be94',
  ]);
});
