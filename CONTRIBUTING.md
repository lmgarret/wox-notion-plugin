# Contributing

Thanks for considering a contribution! This document covers the practical workflow; the [README](README.md#development) describes the toolchain.

## Getting started

```sh
git clone https://github.com/lmgarret/wox-notion-plugin
cd wox-notion-plugin
pnpm install   # also installs the git hooks
```

`pnpm install` registers two hooks via [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks):

- **pre-commit** — [lint-staged](https://github.com/lint-staged/lint-staged) runs `biome check --write` on staged files.
- **commit-msg** — [commitlint](https://commitlint.js.org) validates the message against Conventional Commits.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org); release-please derives versions and the changelog from them:

- `feat: ...` → minor bump
- `fix: ...` → patch bump
- `feat!: ...` or a `BREAKING CHANGE:` footer → major bump
- `chore:`, `docs:`, `ci:`, `refactor:`, `test:` → no release, still linted

## Before opening a PR

```sh
pnpm lint && pnpm typecheck && pnpm test
```

CI runs the same checks plus a packaging step on every PR. New behavior should come with unit tests — the Notion API is mocked (see `tests/helpers.ts`), so tests are fast and deterministic.

## Testing against a real Wox

`pnpm dev` keeps `dist/` up to date as a complete plugin directory. Add `dist/` as a local/dev plugin directory in Wox and reload the plugin to try your changes end-to-end.

## Releasing (maintainers)

Merge the release-please PR. That publishes a GitHub release, and CI attaches the `.wox` package built from the tagged commit.
