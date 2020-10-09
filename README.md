# JupiterOne Integration

This integration is used to ingest the following data into JupiterOne:

- Hosts / Host Assets
- Host Vulnerabilities
- Web Apps
- Web App Vulnerabilities

Please see the [JupiterOne Vulnerability Data Model][vuln-data-model].

The data is ingested via the Qualys API using user credentials (username and
password).

## Development Environment

### Prerequisites

You must have Node.JS installed to run this project. If you don't already have
it installed, you can can download the installer
[here](https://nodejs.org/en/download/). You can alternatively install Node.JS
using a version manager like [fnm](https://github.com/Schniz/fnm) or
[nvm](https://github.com/nvm-sh/nvm).

### Setup

#### Installing dependencies

From the root of this project, run `npm install` to install dependencies. If you
have `yarn` installed, you can install dependencies by running `yarn`.

#### Loading credentials

Create a `.env` file at the root of this project and add environment variables
to match what is in `src/instanceConfigFields.json`. The `.env` file is ignored
by git, so you won't have to worry about accidentally pushing credentials.

Given this example configuration:

```json
{
  "qualysUsername": {
    "type": "string"
  },
  "qualysPassword": {
    "type": "string",
    "mask": true
  },
  "qualysApiUrl": {
    "type": "string"
  }
}
```

You would provide a `.env` file like this:

```bash
QUALYS_USERNAME=X
QUALYS_PASSWORD=X
QUALYS_API_URL=https://qualysapi.qg3.apps.qualys.com
```

The snake cased environment variables will automatically be converted and
applied to the camel cased configuration field. So for example, `CLIENT_ID` will
apply to the `clientId` config field, `CLIENT_SECRET` will apply to
`clientSecret`, and `MY_SUPER_SECRET_CONFIGURATION_VALUE` will apply to a
`mySuperSecretConfigurationValue` configuration field.

## Running the integration

To start collecting data, run `yarn start` from the root of the project. This
will load in your configuration and execute the steps stored in `src/steps`.

## Project structure

This is the expected project structure for running integrations.

```text
src/
  /instanceConfigFields.json
  /validateInvocation.ts
  /getStepStartStates.ts
  steps/
    *.ts
    // add additional steps here
```

Each of the files listed above contribute to creating an
[integration configuration](https://github.com/JupiterOne/integration-sdk/blob/master/docs/development.md#the-integration-framework).

Additional files can be placed under `src` and referenced from each of the
integration files.

## Documentation

### Development

Please reference the `@jupiterone/integration-sdk`
[development documentation](https://github.com/JupiterOne/integration-sdk/blob/master/docs/development.md)
for more information on how to use the SDK.

See [docs/development.md](docs/development.md) for details about how to get
started with developing this integration.

### Integration usage and resource coverage

More information about the resources covered by this integration and how to
setup the integration in JupiterOne can be found in
[docs/jupiterone.md](docs/jupiterone.md).

### Changelog

The history of this integration's development can be viewed at
[CHANGELOG.md](CHANGELOG.md).

## Qualys API Documentation

Qualys API QUick Reference:

<https://www.qualys.com/docs/qualys-api-quick-reference.pdf>

Qualys API User Guide:

<https://www.qualys.com/docs/qualys-api-vmpc-user-guide.pdf>

Qualys API (web page):

<https://debug.qualys.com/qwebhelp/fo_portal/api_doc/scans/index.htm>

Qualys Web Application Scanning API User Guide:

<https://www.qualys.com/docs/qualys-was-api-user-guide.pdf>

[vuln-data-model]:
  https://support.jupiterone.io/hc/en-us/articles/360041429733-Data-Model-for-Vulnerability-Management
