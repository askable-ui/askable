# Analytics dashboard React example

A runnable Next.js dashboard example showing how Askable can annotate complex product surfaces like metrics grids, charts, tables, and sidebars.

## Local development

```bash
npm ci
npm run dev
```

To verify the production build locally:

```bash
npm run build
npm run start
```

## Vercel deployment

This example is deployed by Vercel's native GitHub integration.

### What shows up in GitHub

When the Vercel GitHub app is connected to this repository and project:

- pull requests touching `examples/analytics-dashboard-react/**` get a **Preview deployment** from Vercel
- GitHub shows a Vercel deployment/status check on the PR
- the PR's checks and deployments UI link to the preview URL
- merges to `main` trigger a new **Production deployment** in Vercel

Vercel's GitHub integration documentation says it provides **Preview Deployment URLs** and comments on GitHub PR preview deployments.

### Recommended Vercel project setup

Configure the Vercel project like this:

- **Root Directory:** `examples/analytics-dashboard-react`
- **Framework Preset:** Next.js
- **Git provider:** GitHub
- **Repository:** `askable-ui/askable`

### How to make previews visible in GitHub

1. Install/connect the Vercel GitHub app for the repo.
2. Make sure this Vercel project is linked to `askable-ui/askable`.
3. Keep automatic Git deployments enabled for this project.
4. Open or update a PR that changes `examples/analytics-dashboard-react/**`.

After that, GitHub should show the Vercel deployment/check automatically, and the preview URL should be accessible from the PR.

### Notes

- The example currently depends on the published `@askable-ui/react` package version from npm.
- If you later want more custom PR behavior than native Vercel provides, we can add targeted GitHub automation on top, but native Vercel integration should be the single deployment authority.
