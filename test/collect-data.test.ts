import {
  createMockStepExecutionContext,
  Recording,
  setupRecording,
} from '@jupiterone/integration-sdk/testing';
import collectDataStep from '../src/steps/collect-data';
import {
  TYPE_QUALYS_WEB_APP,
  TYPE_QUALYS_WEB_APP_FINDING,
  TYPE_QUALYS_HOST,
  TYPE_QUALYS_HOST_FINDING,
  TYPE_QUALYS_VULN,
} from '../src/converters';

jest.setTimeout(60000);

let recording: Recording | undefined;

afterEach(() => {
  recording?.stop();
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

  const context = createMockStepExecutionContext({
    entities: [],
    relationships: [],
    instanceConfig: {
      qualysApiUrl: 'https://BLAH.qg3.apps.qualys.com',
    },
  });

  await collectDataStep.executionHandler(context);

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
    'qid:150001|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%2Fscript%3E%3Cscript%3Efunction()%7bqxss%7d%3B%3C%2Fscript%3E|q-on-webapp:62249034',
    'qid:150012|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|productid-on-webapp:62249034',
    'qid:150012|uri:http://54.173.177.208:8080/bodgeit/login.jsp|password-on-webapp:62249034',
    'qid:150012|uri:http://54.173.177.208:8080/bodgeit/login.jsp|username-on-webapp:62249034',
    'qid:150013|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3Cscript%20src%3Dhttp%3A%2F%2Flocalhost%2Fj%20|q-on-webapp:62249034',
    'qid:150022|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|quantity_10-on-webapp:62249034',
    'qid:150053|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'qid:150079|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/about.jsp|undefined-on-webapp:62249034',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|undefined-on-webapp:62249034',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|undefined-on-webapp:62249034',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/home.jsp|undefined-on-webapp:62249034',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|undefined-on-webapp:62249034',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/search.jsp|undefined-on-webapp:62249034',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034',
    'qid:150084|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%0a%0dscript%20a%3D4%3Eqss%3D7%3C%0a%0d%2Fscript%3E|q-on-webapp:62249034',
    'qid:150085|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034',
    'qid:150085|uri:https://api.dev.jupiterone.io/|undefined-on-webapp:61890472',
    'qid:150112|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'qid:150112|uri:http://54.173.177.208:8080/bodgeit/register.jsp|undefined-on-webapp:62249034',
    'qid:150123|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|b_id-on-webapp:62249034',
    'qid:150123|uri:http://54.173.177.208:8080/bodgeit/|JSESSIONID-on-webapp:62249034',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/about.jsp|undefined-on-webapp:62249034',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|undefined-on-webapp:62249034',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|undefined-on-webapp:62249034',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/home.jsp|undefined-on-webapp:62249034',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|undefined-on-webapp:62249034',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/search.jsp|undefined-on-webapp:62249034',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034',
    'qid:150150|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'qid:150150|uri:http://54.173.177.208:8080/bodgeit/register.jsp|undefined-on-webapp:62249034',
    'qid:150159|uri:http://54.173.177.208:8080/bodgeit/|JSESSIONID-on-webapp:62249034',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/about.jsp|undefined-on-webapp:62249034',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|undefined-on-webapp:62249034',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|undefined-on-webapp:62249034',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/home.jsp|undefined-on-webapp:62249034',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/search.jsp|undefined-on-webapp:62249034',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034',
    'qid:150263|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034',
  ]);

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
    'ecs-cluster-primary',
    'ecs-cluster-primary',
    'i-0906e8b908f2dd0b3',
    'ip-10-55-26-62.ec2.internal',
    'ip-10-55-46-210.ec2.internal',
    'qualys-cloud-agent-test',
    'qualys-cloud-agent-test-neo4j',
    'qualys-cloud-agent-test-wordpress',
    'qualys-cloud-agent-test-wordpress',
    'qualys-cloud-agent-test-wordpress-2',
    'qualys-scanner',
    'qualys-scanner-old',
    'vpn-server-encrypted',
  ]);

  const hostFindingKeys: string[] = [];
  await context.jobState.iterateEntities(
    {
      _type: TYPE_QUALYS_HOST_FINDING,
    },
    (entity) => {
      hostFindingKeys.push(entity._key);
    },
  );

  hostFindingKeys.sort();

  expect(hostFindingKeys).toEqual([
    'qid:11827|port:443|protocol:tcp-on-host:92662027',
    'qid:11|port:undefined|protocol:undefined-on-host:92661485',
    'qid:197146|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197234|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197236|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197246|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197291|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197301|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197339|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197347|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197371|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197375|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197401|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197424|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197553|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197595|port:undefined|protocol:undefined-on-host:93010479',
    'qid:197595|port:undefined|protocol:undefined-on-host:93010480',
    'qid:197599|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197608|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197617|port:undefined|protocol:undefined-on-host:93010479',
    'qid:197617|port:undefined|protocol:undefined-on-host:93010480',
    'qid:197652|port:undefined|protocol:undefined-on-host:93010479',
    'qid:197652|port:undefined|protocol:undefined-on-host:93010480',
    'qid:197760|port:undefined|protocol:undefined-on-host:93011161',
    'qid:197784|port:undefined|protocol:undefined-on-host:93011161',
    'qid:38170|port:443|protocol:tcp-on-host:92662027',
    'qid:38174|port:443|protocol:tcp-on-host:92662027',
    'qid:38739|port:22|protocol:tcp-on-host:92661485',
    'qid:38739|port:22|protocol:tcp-on-host:92662027',
  ]);

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
    'qualys-host:92661485|has|qid:11|port:undefined|protocol:undefined-on-host:92661485',
    'qualys-host:92661485|has|qid:38739|port:22|protocol:tcp-on-host:92661485',
    'qualys-host:92662027|has|qid:11827|port:443|protocol:tcp-on-host:92662027',
    'qualys-host:92662027|has|qid:38170|port:443|protocol:tcp-on-host:92662027',
    'qualys-host:92662027|has|qid:38174|port:443|protocol:tcp-on-host:92662027',
    'qualys-host:92662027|has|qid:38739|port:22|protocol:tcp-on-host:92662027',
    'qualys-host:93010479|has|qid:197595|port:undefined|protocol:undefined-on-host:93010479',
    'qualys-host:93010479|has|qid:197617|port:undefined|protocol:undefined-on-host:93010479',
    'qualys-host:93010479|has|qid:197652|port:undefined|protocol:undefined-on-host:93010479',
    'qualys-host:93010480|has|qid:197595|port:undefined|protocol:undefined-on-host:93010480',
    'qualys-host:93010480|has|qid:197617|port:undefined|protocol:undefined-on-host:93010480',
    'qualys-host:93010480|has|qid:197652|port:undefined|protocol:undefined-on-host:93010480',
    'qualys-host:93011161|has|qid:197146|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197234|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197236|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197246|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197291|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197301|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197339|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197347|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197371|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197375|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197401|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197424|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197553|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197599|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197608|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197760|port:undefined|protocol:undefined-on-host:93011161',
    'qualys-host:93011161|has|qid:197784|port:undefined|protocol:undefined-on-host:93011161',
  ]);

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
    'qid:11827|port:443|protocol:tcp-on-host:92662027|is|vuln-qid:11827',
    'qid:11|port:undefined|protocol:undefined-on-host:92661485|is|vuln-qid:11',
    'qid:197146|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197146',
    'qid:197234|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197234',
    'qid:197236|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197236',
    'qid:197246|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197246',
    'qid:197291|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197291',
    'qid:197301|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197301',
    'qid:197339|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197339',
    'qid:197347|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197347',
    'qid:197371|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197371',
    'qid:197375|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197375',
    'qid:197401|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197401',
    'qid:197424|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197424',
    'qid:197553|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197553',
    'qid:197595|port:undefined|protocol:undefined-on-host:93010479|is|vuln-qid:197595',
    'qid:197595|port:undefined|protocol:undefined-on-host:93010480|is|vuln-qid:197595',
    'qid:197599|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197599',
    'qid:197608|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197608',
    'qid:197617|port:undefined|protocol:undefined-on-host:93010479|is|vuln-qid:197617',
    'qid:197617|port:undefined|protocol:undefined-on-host:93010480|is|vuln-qid:197617',
    'qid:197652|port:undefined|protocol:undefined-on-host:93010479|is|vuln-qid:197652',
    'qid:197652|port:undefined|protocol:undefined-on-host:93010480|is|vuln-qid:197652',
    'qid:197760|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197760',
    'qid:197784|port:undefined|protocol:undefined-on-host:93011161|is|vuln-qid:197784',
    'qid:38170|port:443|protocol:tcp-on-host:92662027|is|vuln-qid:38170',
    'qid:38174|port:443|protocol:tcp-on-host:92662027|is|vuln-qid:38174',
    'qid:38739|port:22|protocol:tcp-on-host:92661485|is|vuln-qid:38739',
    'qid:38739|port:22|protocol:tcp-on-host:92662027|is|vuln-qid:38739',
  ]);

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
    'web_app:61890472|has|qid:150085|uri:https://api.dev.jupiterone.io/|undefined-on-webapp:61890472',
    'web_app:62249034|has|qid:150001|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%2Fscript%3E%3Cscript%3Efunction()%7bqxss%7d%3B%3C%2Fscript%3E|q-on-webapp:62249034',
    'web_app:62249034|has|qid:150012|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|productid-on-webapp:62249034',
    'web_app:62249034|has|qid:150012|uri:http://54.173.177.208:8080/bodgeit/login.jsp|password-on-webapp:62249034',
    'web_app:62249034|has|qid:150012|uri:http://54.173.177.208:8080/bodgeit/login.jsp|username-on-webapp:62249034',
    'web_app:62249034|has|qid:150013|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3Cscript%20src%3Dhttp%3A%2F%2Flocalhost%2Fj%20|q-on-webapp:62249034',
    'web_app:62249034|has|qid:150022|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|quantity_10-on-webapp:62249034',
    'web_app:62249034|has|qid:150053|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150079|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150081|uri:http://54.173.177.208:8080/bodgeit/about.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150081|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150081|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150081|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150081|uri:http://54.173.177.208:8080/bodgeit/home.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150081|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150081|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150081|uri:http://54.173.177.208:8080/bodgeit/search.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150081|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150084|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%0a%0dscript%20a%3D4%3Eqss%3D7%3C%0a%0d%2Fscript%3E|q-on-webapp:62249034',
    'web_app:62249034|has|qid:150085|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150112|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150112|uri:http://54.173.177.208:8080/bodgeit/register.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150123|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|b_id-on-webapp:62249034',
    'web_app:62249034|has|qid:150123|uri:http://54.173.177.208:8080/bodgeit/|JSESSIONID-on-webapp:62249034',
    'web_app:62249034|has|qid:150124|uri:http://54.173.177.208:8080/bodgeit/about.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150124|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150124|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150124|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150124|uri:http://54.173.177.208:8080/bodgeit/home.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150124|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150124|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150124|uri:http://54.173.177.208:8080/bodgeit/search.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150124|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150150|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150150|uri:http://54.173.177.208:8080/bodgeit/register.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150159|uri:http://54.173.177.208:8080/bodgeit/|JSESSIONID-on-webapp:62249034',
    'web_app:62249034|has|qid:150246|uri:http://54.173.177.208:8080/bodgeit/about.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150246|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150246|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150246|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150246|uri:http://54.173.177.208:8080/bodgeit/home.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150246|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150246|uri:http://54.173.177.208:8080/bodgeit/search.jsp|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150246|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034',
    'web_app:62249034|has|qid:150263|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034',
  ]);

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
    'qid:150001|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%2Fscript%3E%3Cscript%3Efunction()%7bqxss%7d%3B%3C%2Fscript%3E|q-on-webapp:62249034|is|vuln-qid:150001',
    'qid:150012|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|productid-on-webapp:62249034|is|vuln-qid:150012',
    'qid:150012|uri:http://54.173.177.208:8080/bodgeit/login.jsp|password-on-webapp:62249034|is|vuln-qid:150012',
    'qid:150012|uri:http://54.173.177.208:8080/bodgeit/login.jsp|username-on-webapp:62249034|is|vuln-qid:150012',
    'qid:150013|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3Cscript%20src%3Dhttp%3A%2F%2Flocalhost%2Fj%20|q-on-webapp:62249034|is|vuln-qid:150013',
    'qid:150022|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|quantity_10-on-webapp:62249034|is|vuln-qid:150022',
    'qid:150053|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034|is|vuln-qid:150053',
    'qid:150079|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034|is|vuln-qid:150079',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/about.jsp|undefined-on-webapp:62249034|is|vuln-qid:150081',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|undefined-on-webapp:62249034|is|vuln-qid:150081',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|undefined-on-webapp:62249034|is|vuln-qid:150081',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034|is|vuln-qid:150081',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/home.jsp|undefined-on-webapp:62249034|is|vuln-qid:150081',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034|is|vuln-qid:150081',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|undefined-on-webapp:62249034|is|vuln-qid:150081',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/search.jsp|undefined-on-webapp:62249034|is|vuln-qid:150081',
    'qid:150081|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034|is|vuln-qid:150081',
    'qid:150084|uri:http://54.173.177.208:8080/bodgeit/search.jsp?q=%3C%0a%0dscript%20a%3D4%3Eqss%3D7%3C%0a%0d%2Fscript%3E|q-on-webapp:62249034|is|vuln-qid:150084',
    'qid:150085|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034|is|vuln-qid:150085',
    'qid:150085|uri:https://api.dev.jupiterone.io/|undefined-on-webapp:61890472|is|vuln-qid:150085',
    'qid:150112|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034|is|vuln-qid:150112',
    'qid:150112|uri:http://54.173.177.208:8080/bodgeit/register.jsp|undefined-on-webapp:62249034|is|vuln-qid:150112',
    'qid:150123|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|b_id-on-webapp:62249034|is|vuln-qid:150123',
    'qid:150123|uri:http://54.173.177.208:8080/bodgeit/|JSESSIONID-on-webapp:62249034|is|vuln-qid:150123',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/about.jsp|undefined-on-webapp:62249034|is|vuln-qid:150124',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|undefined-on-webapp:62249034|is|vuln-qid:150124',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|undefined-on-webapp:62249034|is|vuln-qid:150124',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034|is|vuln-qid:150124',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/home.jsp|undefined-on-webapp:62249034|is|vuln-qid:150124',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034|is|vuln-qid:150124',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/product.jsp?typeid=6|undefined-on-webapp:62249034|is|vuln-qid:150124',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/search.jsp|undefined-on-webapp:62249034|is|vuln-qid:150124',
    'qid:150124|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034|is|vuln-qid:150124',
    'qid:150150|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034|is|vuln-qid:150150',
    'qid:150150|uri:http://54.173.177.208:8080/bodgeit/register.jsp|undefined-on-webapp:62249034|is|vuln-qid:150150',
    'qid:150159|uri:http://54.173.177.208:8080/bodgeit/|JSESSIONID-on-webapp:62249034|is|vuln-qid:150159',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/about.jsp|undefined-on-webapp:62249034|is|vuln-qid:150246',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/admin.jsp|undefined-on-webapp:62249034|is|vuln-qid:150246',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/basket.jsp|undefined-on-webapp:62249034|is|vuln-qid:150246',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/contact.jsp|undefined-on-webapp:62249034|is|vuln-qid:150246',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/home.jsp|undefined-on-webapp:62249034|is|vuln-qid:150246',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/login.jsp|undefined-on-webapp:62249034|is|vuln-qid:150246',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/search.jsp|undefined-on-webapp:62249034|is|vuln-qid:150246',
    'qid:150246|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034|is|vuln-qid:150246',
    'qid:150263|uri:http://54.173.177.208:8080/bodgeit/|undefined-on-webapp:62249034|is|vuln-qid:150263',
  ]);
});
