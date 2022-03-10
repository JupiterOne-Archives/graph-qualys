# Development

The Qualys integration uses various endpoints within the collection of Qualys
APIs to ingest data.

## Provider account setup

1. Request a [free trial of Qualys](https://www.qualys.com/free-trial/). You'll
   receive an email with your username and a link to access and reset your
   password.
2. Create a Web Application and a Vulnerabilty Scan of the application.
3. Find your API URL from the **Help** -> **About** link in the web app.

![API URL from About Page](./images/qualys-help-about-api-url.png)

## Configure your .env

Here's the recommended `.env` for this project (filling in your credentials):

```ini
QUALYS_USERNAME=
QUALYS_PASSWORD=
QUALYS_API_URL=https://qualysapi.qg3.apps.qualys.com
```

## Execution

With the `.env` file in place, execute the integration:

```sh
yarn start
```

This project also provides a [mock Qualys server](#mock-qualys-server).

## GCP Cloud Agent

GCP Cloud Agent can be used to ingest detections from GCP Hosts. The
instructions on this page can be followed to connect Qualys with a GCP Project:
[Deploy Cloud Agent Fromt GCP](https://success.qualys.com/discussions/s/article/000005839)

## Mock Qualys Server

The mock Qualys server was created to facilitate performance and load testing.
It can be started on your development machine:

```sh
yarn start:qualys
```

Change your `.env` so the integration will connect to this service:

```ini
QUALYS_API_URL=http://localhost:8080
```

### Public Access

You may also run the integration on a public IP address on an Amazon Linux
computer in AWS, 2 vCPU + 8GB is necessary to support concurrent requests
(memory required to generate the response data).

1. Launch an instance
   - Default VPC
   - Public IP address
   - New security group to isolate
   - Add rule to allow inbound TCP on port 8080
2. Use EC2 Instance Connect in browser to gain terminal access
3. Perform the following to load and execute the code

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 12.20.0
curl -o- -L https://yarnpkg.com/install.sh | bash
. ~/.bash_profile
sudo yum install git
git clone https://github.com/JupiterOne/graph-qualys.git
cd graph-qualys
yarn install
LOG_REQUESTS=1 NODE_OPTIONS='--max-old-space-size=8192' yarn start:qualys
```

Edit `graph-qualys/tools/qualys-server/start.ts` to configure the amount of data
generated.

Test access with the following:

```sh
curl -d 'ids=1,2,3' http://ec2-18-207-1-21.compute-1.amazonaws.com:8080/api/2.0/fo/asset/host/vm/detection/
```
