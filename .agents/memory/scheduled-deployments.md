---
name: Scheduled Deployments setup
description: How to actually get a Scheduled Deployment running for a pnpm-monorepo/artifacts project, since it isn't creatable through the normal artifact tooling.
---

In the pnpm-monorepo "artifacts" model, `createArtifact()` only accepts artifactType values
`expo`, `design-system`, `openscad`, `react-vite`, `slides`, `video-js` — there is no
"scheduled job" artifact type, and `verifyAndReplaceArtifactToml` only edits an existing
artifact's own service block (its `[services.production]` controls that artifact's *main*
deployment target, e.g. autoscale).

**Why:** `getDeploymentInfo()` returns one `deploymentType` for the project's primary
deployment. Replit docs confirm a Scheduled Deployment is a *separate* deployment/artifact
that can coexist with an existing Autoscale/VM deployment in the same project, sharing the
same backend/data — but it is created and scheduled through the **Publishing UI**, not
through `createArtifact`/`artifact.toml`. The Publishing tool takes a plain-language
schedule ("daily at 8am Eastern") and converts it to cron itself.

**How to apply:** When a user wants a recurring background job (e.g. a daily email digest):
1. Build a standalone entrypoint script (no Express app dependency) that does the job and
   exits 0/1 — e.g. `artifacts/<x>/src/digest.ts` compiled to `dist/digest.mjs`.
2. Verify it runs standalone via shell (`node dist/digest.mjs`) with real env/secrets.
3. Do NOT try to wire the schedule via `artifact.toml` or `deployConfig()` — instead tell the
   user to open the Publishing tool and create a new Scheduled Deployment there, pointing at
   the build command (e.g. `pnpm --filter @workspace/<pkg> run build`) and run command (e.g.
   `node --enable-source-maps artifacts/<x>/dist/digest.mjs`), with the desired schedule.
