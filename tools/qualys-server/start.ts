import express from 'express';
import xmlBodyParser from 'express-xml-bodyparser';
import path from 'path';
import { URL } from 'url';

import { generateHostData } from './data';
import { initializeEngine } from './templates';

async function start() {
  const hostData = generateHostData();

  const app = express();
  const port = 8080;

  app.engine('mustache', await initializeEngine());
  app.set('views', path.join(__dirname, 'templates'));
  app.set('view engine', 'mustache');

  app.use(express.text());
  app.use(express.urlencoded({ extended: false }));
  app.use(xmlBodyParser());

  app.get('/api/2.0/fo/activity_log/', (req, res) => {
    res.setHeader('content-type', 'text/csv;charset=UTF-8');
    res.render('activity-log');
  });

  app.get('/qps/rest/portal/version', (req, res) => {
    res.setHeader('content-type', 'application/xml');
    res.render('portal-version');
  });

  app.post('/qps/rest/3.0/search/was/webapp', (req, res) => {
    // TODO: Implement pagination responses
    res.setHeader('content-type', 'application/xml');
    res.render('webapp-list');
  });

  app.get('/api/2.0/fo/asset/host/', (req, res) => {
    const truncationLimit = Number(req.query['truncation_limit']);
    const idStart = Number(req.query['id_max']) || 0;
    const idEnd = idStart + truncationLimit;
    const hosts = hostData.hosts.slice(idStart, idEnd);

    let nextUrl: URL | undefined;
    if (idEnd < hostData.hosts.length) {
      nextUrl = new URL(req.originalUrl, 'http://localhost:8080');
      nextUrl.searchParams.set('id_max', String(idEnd));
    }

    res.setHeader('content-type', 'text/xml');
    res.render('host-id-list', { hostIds: hosts.map((e) => e.id), nextUrl });
  });

  app.post('/qps/rest/2.0/search/am/hostasset', (req, res) => {
    const qwebHostIds = req.body.servicerequest.filters[0].criteria[0]._;
    const hostIds = qwebHostIds.split(',');
    const hosts = hostIds.map((e) => hostData.hostsById.get(Number(e)));
    res.setHeader('content-type', 'text/xml');
    res.render('host-details-list', { hosts });
  });

  app.post('/api/2.0/fo/asset/host/vm/detection/', (req, res) => {
    const hostIds = req.body.ids.split(',');
    const hosts = hostIds.map((e) => hostData.hostsById.get(Number(e)));
    res.setHeader('content-type', 'text/xml');
    res.render('host-detection-list', { hosts });
  });

  app.post('/api/2.0/fo/knowledge_base/vuln', (req, res) => {
    const ids = req.query.ids as string | undefined;
    const qidList = ids ? ids.split(',') : [];
    res.setHeader('content-type', 'text/xml');
    res.render('vuln-list', { qidList });
  });

  app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
  });
}

start().catch((err) => {
  throw err;
});
