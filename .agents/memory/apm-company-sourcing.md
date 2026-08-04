---
name: APM tracker company sourcing
description: Where to find new APM program companies to add to APM Radar, and the verification bar before adding one.
---

apmlist.com (Exponent's curated list, updated weekly) is the reference source for discovering new APM/RPM programs to add. It has two separate tables: "Open APM Programs" (full-time) and "Open PM Internships" — only the full-time table is in scope, since this tracker excludes internships/co-ops by design.

**Why:** apmlist.com's company names and "Apply" links reveal the underlying ATS, but the exact board token/tenant is often NOT the obvious guess (e.g. DoorDash's Greenhouse token is `doordashusa`, not `doordash`; Red Hat's Workday tenant is `jobs`, not `External`/`Careers`). Never add a company config from a guessed token — always curl-verify the real endpoint returns 200 with real job data first, consistent with the project's "never trust unverified" rule.

**How to apply:** When asked to add companies from this list, fetch the full-time table via webFetch, diff company names against the existing `COMPANIES` array in `artifacts/api-server/src/lib/jobs/companies.ts`, then for each candidate: infer likely ATS from the apply URL domain pattern, curl-verify the real endpoint (Greenhouse `boards-api.greenhouse.io/v1/boards/{token}/jobs`, Ashby `api.ashbyhq.com/posting-api/job-board/{name}`, Workday `POST https://{host}/wday/cxs/{company}/{tenant}/jobs`, Oracle ORC `hcmRestApi/resources/latest/recruitingCEJobRequisitions`), and only add configs for endpoints that return 200 with a real job array. Companies with custom/harder-to-locate backends (seen so far: Airbnb, Amazon, ByteDance/TikTok, Tesla, X/Twitter, Snap, Cisco, Mastercard, Mozilla, Expedia) are left out rather than guessed.
