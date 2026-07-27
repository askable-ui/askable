# Docs Versioning

askable-ui supports two kinds of docs URLs:

- `/docs/` — latest stable docs
- `/docs/<version>/` — a version-specific alias for the current release, or a
  frozen snapshot after that version is archived

## Current version

- Latest stable: `v0.16.0`
- Versioned current docs URL: `/docs/v0.16.0/`

## Archived versions

No archived major versions yet.

The current release is rebuilt at both `/docs/` and `/docs/v0.16.0/` on every
deployment. Only versions listed under `archived` are copied from frozen
snapshots.

## Breaking release workflow

For a breaking release:

1. snapshot the current docs with `npm run snapshot:current`
2. move that version into `archived` in `versions.json`
3. update `current` to the new major version
4. update docs content for the new release
5. publish with `npm run build:versioned`
