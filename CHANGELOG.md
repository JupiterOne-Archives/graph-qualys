# Changelog

## [Unreleased]

## 3.1.0 2020-09-25

### Changed

- Added a lot more logging
- Various changes attempting to limit amount of data ingested

### Fixed

- A few unhandled promises

## 3.0.3 2020-09-16

### Changed

- Add more request logging
- Checked for no `lastId` in determining whether there is another page

## 3.0.2 2020-09-15

### Changed

- Allow 60 seconds for responses
- Bump web app scan request concurrency to 3

## 3.0.1 2020-09-15

### Changed

- Retry fetch errors up to 10 times
- Limit web app scan request concurrency to 1

## 3.0.0 2020-09-10

### Changed

- Update to `@jupiterone/integration-sdk-*@3.2.0`
- Setup instructions to help get a Qualys trial going

## 2.2.0 2020-06-29

### Changed

- Update to `@jupiterone/integration-sdk-*@2.2.0`

## 2.1.0 2020-06-09

### Fixed

- Package build

## 2.0.0 2020-06-08

### Changed

- Update to `@jupiterone/integration-sdk-*@1.1.0`
- Add `husky.config.js` to get hooks working

## 1.2.2 2020-05-20

### Changed

- `Finding._key` generation and checking for duplicates

## 1.2.1 2020-05-20

- Better error handling

## 1.0.2 2020-05-05

### Added

- Add tooling for running fake Qualys knowledge base server
- Add documentation for configuring `.env` file
- Add additional logging if API requests return no results
- Add additional logging if licensing restriction does not allow access to
  knowledge base

## 1.0.1

- Initial version for development and testing
