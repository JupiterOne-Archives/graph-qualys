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

## Running integration

```sh
yarn start
```

Note that there is a mock Qualys server that is helpful for working out API
interactions:

```sh
yarn start:qualys
```

Change your `.env` so the integration will connect to this service:

```ini
QUALYS_API_URL=http://localhost:8080
```
