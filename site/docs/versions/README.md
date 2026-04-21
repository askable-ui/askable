# Versioned docs snapshots

This directory stores frozen **built** docs snapshots for archived major versions.

The current release (`v0.6.0`) is built on every deploy and published to both:

- `/docs/` (latest stable)
- `/docs/v0.6.0/` (version-specific URL)

## How it works

- `site/docs/versions.json` declares the current docs version and any archived versions.
- `npm run build:versioned` builds:
  - latest docs at `/docs/`
  - the current version at `/docs/<current-version>/`
  - any archived snapshots listed in `versions.json`
- archived versions are served from this directory and are **not rebuilt from source** during normal deploys

## When cutting a breaking release

Before changing the current docs to the new major version:

```bash
cd site/docs
npm ci
npm run snapshot:current
```

That captures the current docs as a frozen snapshot under `site/docs/versions/<current-version>/`.

Then:
1. update `versions.json`
2. move the previous current version into `archived`
3. set the new `current` version
4. update docs content for the new major version
5. deploy with `npm run build:versioned`

## Policy

- patch/minor releases: update live docs only
- breaking/major releases: preserve the previous major docs as a snapshot
