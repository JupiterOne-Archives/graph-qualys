import http, { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

export interface StartOutput {
  server: http.Server;
  port: number | undefined;
}

export interface RunOptions {
  port: number;
}

function buildVulnXml(qid: string) {
  return `
<VULN>
  <QID>${qid}</QID>
  <VULN_TYPE>Vulnerability</VULN_TYPE>
  <SEVERITY_LEVEL>5</SEVERITY_LEVEL>
  <TITLE>
    <![CDATA[Microsoft Windows Server Service Could Allow Remote Code Execution (MS08-067)]]>
  </TITLE>
  <CATEGORY>Windows</CATEGORY>
  <LAST_SERVICE_MODIFICATION_DATETIME>2009-02-12T18:51:23Z</LAST_SERVICE_MODIFICATION_DATETIME>
  <PUBLISHED_DATETIME>2008-10-23T07:00:00Z</PUBLISHED_DATETIME>
  <BUGTRAQ_LIST>
    <BUGTRAQ>
      <ID>
        <![CDATA[31874]]>
      </ID>
      <URL>
        <![CDATA[http://www.securityfocus.com/bid/31874]]>
      </URL>
    </BUGTRAQ>
  </BUGTRAQ_LIST>
  <PATCHABLE>1</PATCHABLE>
  <VENDOR_REFERENCE_LIST>
    <VENDOR_REFERENCE>
      <ID>
        <![CDATA[MS08-067]]>
      </ID>
      <URL>
        <![CDATA[http://www.microsoft.com/technet/security/bulletin/MS08-067.mspx]]>
      </URL>
    </VENDOR_REFERENCE>
  </VENDOR_REFERENCE_LIST>
  <CVE_LIST>
    <CVE>
      <ID>
        <![CDATA[CVE-2008-4250]]>
      </ID>
      <URL>
        <![CDATA[http://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2008-4250]]>
      </URL>
    </CVE>
  </CVE_LIST>
  <DIAGNOSIS>
    <![CDATA[The Microsoft Windows Server service provides RPC support […] ]]>
  </DIAGNOSIS>
  <CONSEQUENCE>
    <![CDATA[An attacker who successfully exploits [...] ]]>
  </CONSEQUENCE>
  <SOLUTION>
    <![CDATA[Patch:<BR>
Following are links for downloading patches to fix the vulnerabilities:
[…]
<P>Windows Vista and Windows Vista Service Pack 1:<BR><A HREF="http://www.microsoft.com/downloads/details.aspx?familyid=18FDFF67-C723-42BD-AC5C-CAC7D8713B21" TARGET="_blank">http://www.microsoft.com/downloads/details.aspx?familyid=18FDFF67-C723-42BD-AC5C-CAC7D8713B21</A><P>For a complete list of patch download links, please refer to <A HREF="http://www.microsoft.com/technet/security/bulletin/MS08-067.mspx" TARGET="_blank">Microsoft Security Bulletin MS08-067</A>.

<P>Virtual Patches:<BR><A HREF="http://www.trendmicro.com/vulnerabilitycontrols "TARGET="_blank">Trend Micro Virtual Patching</A><BR>
Virtual Patch #1002975: Server Service Vulnerability (wkssvc)<BR>
Virtual Patch #1003080: Server Service Vulnerability (srvsvc)<BR>
Virtual Patch #1003292: Block Conficker.B++ Worm Incoming Named Pipe Connection<BR>
Virtual Patch #1003293: Block Conficker.B++ Worm Outgoing Named Pipe Connection<BR>
]]>
  </SOLUTION>
  <CORRELATION>
    <EXPLOITS>
      <EXPLT_SRC>
        <SRC_NAME>
          <![CDATA[The Exploit-DB]]>
        </SRC_NAME>
        <EXPLT_LIST>
          <EXPLT>
            <REF>
              <![CDATA[CVE-2008-4250]]>
            </REF>
            <DESC>
              <![CDATA[MS Windows Server Service Code Execution PoC (MS08-067) - The Exploit-DB Ref : 6824]]>
            </DESC>
            <LINK>
              <![CDATA[http://www.exploit-db.com/exploits/6824]]>
            </LINK>
          </EXPLT>
          <EXPLT>
            <REF>
              <![CDATA[CVE-2008-4250]]>
            </REF>
            <DESC>
              <![CDATA[MS Windows Server Service Code Execution Exploit (MS08-067) - The Exploit-DB Ref : 7104]]>
            </DESC>
            <LINK>
              <![CDATA[http://www.exploit-db.com/exploits/7104]]>
            </LINK>
          </EXPLT>
          <EXPLT>
            <REF>
              <![CDATA[CVE-2008-4250]]>
            </REF>
            <DESC>
              <![CDATA[MS Windows Server Service Code Execution Exploit (MS08-067) (2k/2k3) - The Exploit-DB Ref : 7132]]>
            </DESC>
            <LINK>
              <![CDATA[http://www.exploit-db.com/exploits/7132]]>
            </LINK>
          </EXPLT>
          <EXPLT>
            <REF>
              <![CDATA[CVE-2008-4250]]>
            </REF>
            <DESC>
              <![CDATA[Microsoft Server Service Relative Path Stack Corruption - The Exploit-DB Ref : 16362]]>
            </DESC>
            <LINK>
              <![CDATA[http://www.exploit-db.com/exploits/16362]]>
            </LINK>
          </EXPLT>
        </EXPLT_LIST>
      </EXPLT_SRC>
      <EXPLT_SRC>
        <SRC_NAME>
          <![CDATA[Metasploit]]>
        </SRC_NAME>
        <EXPLT_LIST>
          <EXPLT>
            <REF>
              <![CDATA[CVE-2008-4250]]>
            </REF>
            <DESC>
              <![CDATA[Microsoft Server Service Relative Path Stack Corruption  - Metasploit Ref : /modules/exploit/windows/smb/ms08_067_netapi]]>
            </DESC>
            <LINK>
              <![CDATA[http://www.metasploit.com/modules/exploit/windows/smb/ms08_067_netapi]]>
            </LINK>
          </EXPLT>
        </EXPLT_LIST>
      </EXPLT_SRC>
    </EXPLOITS>
    <MALWARE>
      <MW_SRC>
        <SRC_NAME>
          <![CDATA[Trend Micro]]>
        </SRC_NAME>
        <MW_LIST>
          <MW_INFO>
            <MW_ID>
              <![CDATA[WORM_SPYBOT]]>
            </MW_ID>
            <MW_TYPE>
              <![CDATA[Worm]]>
            </MW_TYPE>
            <MW_PLATFORM>
              <![CDATA[Windows 98,  ME,  NT, 2000,  XP,  Server 2003]]>
            </MW_PLATFORM>
            <MW_RATING>
              <![CDATA[Low]]>
            </MW_RATING>
            <MW_LINK>
              <![CDATA[http://about-threats.trendmicro.com/Malware.aspx?language=us&name=WORM_SPYBOT.AZI]]>
            </MW_LINK>
          </MW_INFO>
          <MW_INFO>
            <MW_ID>
              <![CDATA[WORM_NEERIS]]>
            </MW_ID>
            <MW_TYPE>
              <![CDATA[Worm]]>
            </MW_TYPE>
            <MW_PLATFORM>
              <![CDATA[Windows ME,  NT, 2000,  XP,  Server 2003,  Vista 32 Bit]]>
            </MW_PLATFORM>
            <MW_RATING>
              <![CDATA[Low]]>
            </MW_RATING>
            <MW_LINK>
              <![CDATA[http://about-threats.trendmicro.com/Malware.aspx?language=us&name=WORM_NEERIS.A]]>
            </MW_LINK>
          </MW_INFO>
        </MW_LIST>
      </MW_SRC>
    </MALWARE>
  </CORRELATION>
  <CVSS>
    <BASE>10</BASE>
    <TEMPORAL>8.3</TEMPORAL>
    <ACCESS>
      <VECTOR>3</VECTOR>
      <COMPLEXITY>1</COMPLEXITY>
    </ACCESS>
    <IMPACT>
      <CONFIDENTIALITY>3</CONFIDENTIALITY>
      <INTEGRITY>3</INTEGRITY>
      <AVAILABILITY>3</AVAILABILITY>
    </IMPACT>
    <AUTHENTICATION>1</AUTHENTICATION>
    <EXPLOITABILITY>3</EXPLOITABILITY>
    <REMEDIATION_LEVEL>1</REMEDIATION_LEVEL>
    <REPORT_CONFIDENCE>3</REPORT_CONFIDENCE>
  </CVSS>
  <PCI_FLAG>1</PCI_FLAG>
  <DISCOVERY>
    <REMOTE>1</REMOTE>
    <AUTH_TYPE_LIST>
      <AUTH_TYPE>Windows</AUTH_TYPE>
    </AUTH_TYPE_LIST>
  </DISCOVERY>
</VULN>`;
}

type ServerConfig = {
  host: string;
};

type RequestHandlerInput = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  serverConfig: ServerConfig;
};

type RequestHandlerOutput = {
  body: string;
};

type RequestHandler = (
  input: RequestHandlerInput,
) => Promise<RequestHandlerOutput>;

const ROUTES: Record<string, RequestHandler> = {
  '/api/2.0/fo/knowledge_base/vuln': async function (input) {
    const { req, res, url } = input;
    res.setHeader('content-type', 'text/xml');
    console.log('REQUEST URL: ' + req.url);

    const ids = url.searchParams.get('ids');
    const qidList = ids ? ids.split(',') : [];

    console.log(
      'Responding with fake response for following QIDs: ' + qidList.join(', '),
    );

    const body = `
  <KNOWLEDGE_BASE_VULN_LIST_OUTPUT>
    <RESPONSE>
      <VULN_LIST>
  ${qidList.map(buildVulnXml).join('\n')}
      </VULN_LIST>
    </RESPONSE>
  </KNOWLEDGE_BASE_VULN_LIST_OUTPUT>`;
    return Promise.resolve({ body });
  },
};

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  serverConfig: {
    host: string;
  },
): Promise<RequestHandlerOutput> {
  const url = new URL(req.url!, serverConfig.host);
  const handler = ROUTES[url.pathname];
  if (!handler) {
    res.statusCode = 404;
    return {
      body: 'Not found',
    };
  }

  return handler({
    req,
    res,
    url,
    serverConfig,
  });
}

function handleRequestError(err: Error, res: ServerResponse) {
  console.error('Request error! ' + (err.stack || err.toString()));
  res.statusCode = 500;
  res.write('ERROR!');
}

async function startServer(options: RunOptions) {
  const serverConfig = {
    host: `http://localhost:${options.port}`,
  };

  return new Promise<StartOutput>((resolve, reject) => {
    const server = http.createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        try {
          handleRequest(req, res, serverConfig)
            .then((output) => {
              res.write(output.body);
              res.end();
            })
            .catch((err) => {
              handleRequestError(err, res);
            });
        } catch (err) {
          handleRequestError(err, res);
        }
      },
    );

    server.on('error', (err) => {
      console.log('Error!');
      reject(err);
    });

    server.listen(options.port, () => {
      console.log('HTTP server is running. ' + JSON.stringify(options));

      resolve({
        server,
        port: options.port,
      });
    });
  });
}

export async function run(): Promise<void> {
  const port = process.env.FAKE_QUALYS_KNOWLEDGE_BASE_SERVER_PORT
    ? parseInt(process.env.FAKE_QUALYS_KNOWLEDGE_BASE_SERVER_PORT, 10)
    : 8080;
  await startServer({
    port,
  });
}
