# Changelog

## [1.1.1](https://github.com/anchildress1/supascribe-notes-mcp/compare/v1.1.0...v1.1.1) (2026-08-30)


### Bug Fixes

* **deps:** resolve Dependabot alerts + supascribe-cards skill ([#32](https://github.com/anchildress1/supascribe-notes-mcp/issues/32)) ([57772fb](https://github.com/anchildress1/supascribe-notes-mcp/commit/57772fb0bf55e4eefb1bb74ae2d51fe279cac2e2))

## [1.1.0](https://github.com/anchildress1/supascribe-notes-mcp/compare/v1.0.0...v1.1.0) (2026-07-15)


### Features

* add more tools  ([#5](https://github.com/anchildress1/supascribe-notes-mcp/issues/5)) ([77afcc2](https://github.com/anchildress1/supascribe-notes-mcp/commit/77afcc2cf491fbb1167fcfd69d92e59aac74f0d6))
* Deleted at wiring ([#20](https://github.com/anchildress1/supascribe-notes-mcp/issues/20)) ([2b07ab6](https://github.com/anchildress1/supascribe-notes-mcp/commit/2b07ab679770dabbd6550cf616866a6cc8d4e2cf))
* **search:** add keyword-based loose card search ([#11](https://github.com/anchildress1/supascribe-notes-mcp/issues/11)) ([ead13fc](https://github.com/anchildress1/supascribe-notes-mcp/commit/ead13fc67d9dde303cbf025a9fe8fee8a5feba44))
* **soft-delete:** accept and propagate deleted_at through the full stack ([#24](https://github.com/anchildress1/supascribe-notes-mcp/issues/24)) ([dfa2d74](https://github.com/anchildress1/supascribe-notes-mcp/commit/dfa2d741f289c25b6222b97a2ca25e4eec44c968))


### Bug Fixes

* **auth:** consolidate MCP protocol at the site root, harden the authorize flow, and clear dependency CVEs ([#26](https://github.com/anchildress1/supascribe-notes-mcp/issues/26)) ([0778e77](https://github.com/anchildress1/supascribe-notes-mcp/commit/0778e779e2516856f89f0958fd0dc65ad58c4165))
* **build:** swap checkmark-scoped rai-lint plugin, exclude CHANGELOG.md, flesh out README ([#27](https://github.com/anchildress1/supascribe-notes-mcp/issues/27)) ([5b84e7a](https://github.com/anchildress1/supascribe-notes-mcp/commit/5b84e7af9a0d7a3af9b034f958357102c5ab9014))
* **db:** harden function search_path and move pg_trgm out of public ([#7](https://github.com/anchildress1/supascribe-notes-mcp/issues/7)) ([41d7bc5](https://github.com/anchildress1/supascribe-notes-mcp/commit/41d7bc5e4318ba232d1ca4419f44d21b540c1e52))
* **mcp:** stabilize chatgpt app tool listing ([#9](https://github.com/anchildress1/supascribe-notes-mcp/issues/9)) ([e4c67b8](https://github.com/anchildress1/supascribe-notes-mcp/commit/e4c67b884e2e019c943eb64aac219f62628b639f))

## 1.0.0 (2026-02-13)

### ⚠ BREAKING CHANGES

- OAuth consent flow no longer requires user authentication

### Features

- initialize project with core structure ([18f8731](https://github.com/anchildress1/supascribe-notes/commit/18f87312a7777ffaeeebfa4cb2ba0278d1cb090c))
- refactor/auth oauth ([#2](https://github.com/anchildress1/supascribe-notes/issues/2)) ([edb040a](https://github.com/anchildress1/supascribe-notes/commit/edb040a509dfeb589e9bd3617bcc15d893cdf2bc))
