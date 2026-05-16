# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0]

### Additions

- Added `onRequest` and `onResponse` interceptors to modify request and response contexts dynamically.
- Added automatic retry configuration (`retry` option) for transient network and HTTP errors

## [1.1.1]

### Fixed

- Authentication token callback can return undefined

## [1.1.0]

### Added

- Authentication token support (static strings, dynamic callbacks, and custom headers)

## [1.0.0] Initial Commit

### Added

- @riao/rest http client
