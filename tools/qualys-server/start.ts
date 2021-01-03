import express from 'express';
import xmlBodyParser from 'express-xml-bodyparser';
import onFinished from 'on-finished';
import path from 'path';
import { URL } from 'url';

import { generateHostData } from './data';
import { initializeEngine } from './templates';

async function start() {
  const hostData = generateHostData();

  console.log(
    { hosts: { length: hostData.hosts.length, idRange: hostData.hostIdRange } },
    'Generated hosts, restart to get new set',
  );

  const app = express();
  const port = 8080;

  app.engine('mustache', await initializeEngine());
  app.set('views', path.join(__dirname, 'templates'));
  app.set('view engine', 'mustache');

  app.use(express.text());
  app.use(express.urlencoded({ extended: false }));
  app.use(xmlBodyParser());

  app.use((req, res, next) => {
    res.setHeader('x-ratelimit-limit', 10000);
    res.setHeader('x-ratelimit-remaining', 10000);
    res.setHeader('x-ratelimit-window-sec', 3600);
    res.setHeader('x-ratelimit-towait-sec', 0);
    next();
  });

  if (process.env.LOG_REQUESTS) {
    app.use((req, res, next) => {
      console.log(Date.now(), req.url, 'received request');
      onFinished(res, (err, res) => {
        console.log(Date.now(), req.url, 'response finished');
      });
      next();
    });
  }

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
    const idStart = Number(req.query['id_max']) || hostData.hostIdRange.start;
    const idEnd = idStart + truncationLimit;
    const hosts = hostData.hosts.slice(idStart, idEnd);

    let nextUrl: URL | undefined;
    if (idEnd < hostData.hosts.length) {
      nextUrl = new URL(req.originalUrl, `http://${req.hostname}:8080`);
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

  let detectionsConcurrencyRunning = 0;
  app.post('/api/2.0/fo/asset/host/vm/detection/', (req, res) => {
    const hostIds = req.body.ids.split(',');
    const hosts = hostIds.map((e) => hostData.hostsById.get(Number(e)));

    detectionsConcurrencyRunning++;
    console.log('concurrency: ', detectionsConcurrencyRunning);

    res.set('x-concurrency-limit-limit', ['15']);
    res.set('x-concurrency-limit-running', [
      String(detectionsConcurrencyRunning),
    ]);
    res.set('content-type', 'text/xml');

    const hostTime = Math.random() * 10;
    const maximumTime = 1000 * 10;
    const responseTime = Math.min(
      hostIds.length * hostTime + Math.round(Math.random() * 1000),
      maximumTime,
    );

    setTimeout(() => {
      res.render('host-detection-list', { hosts }, (err, html) => {
        if (err) {
          console.error(err);
          res.status(500);
        } else {
          res.send(Buffer.from(html));
        }
        detectionsConcurrencyRunning--;
      });
    }, responseTime);
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
