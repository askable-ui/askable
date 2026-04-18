# Docs Versioning

askable-ui supports two kinds of docs URLs:

- `/docs/` — latest stable docs
- `/docs/<version>/` — frozen version-specific docs snapshots

## Current version

- Latest stable: `v0.5.0`
- Versioned current docs URL: `/docs/v0.5.0/`

## Archived versions

No archived major versions yet.

The current release is also published at `/docs/v0.5.0/` so version-specific links work before the first breaking release.

## Breaking release workflow

For a breaking release:

1. snapshot the current docs with `npm run snapshot:current`
2. move that version into `archived` in `versions.json`
3. update `current` to the new major version
4. update docs content for the new release
5. publish with `npm run build:versioned`
