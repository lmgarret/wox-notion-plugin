# Security Policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately via
[GitHub's private vulnerability reporting](https://github.com/lmgarret/wox-notion-plugin/security/advisories/new)
rather than opening a public issue. You should get a response within a week.

## Scope notes

- Your Notion integration token is stored by Wox's plugin settings storage on
  your machine and is only ever sent to `api.notion.com` via the official
  `@notionhq/client` SDK.
- The plugin makes no network calls other than to the Notion API.
