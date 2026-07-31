---
name: APM tracker ATS endpoints
description: Which internal careers JSON endpoints work per company, and quirks discovered while building the APM job tracker fetchers.
---

# Verified working endpoints (as of 2026-07-31)
- Greenhouse: `boards-api.greenhouse.io/v1/boards/{slug}/jobs` — linkedin, lyft, coinbase, instacart, hubspotjobs, block. No search param; filter titles client-side.
- Lever: `api.lever.co/v0/postings/spotify?mode=json`.
- Workday cxs (`POST https://{host}/wday/cxs/{company}/{tenant}/jobs`, body `{appliedFacets:{},limit,offset,searchText}`):
  - salesforce.wd1 / External_Career_Site (wd5 is dead)
  - capitalone.wd12 / Capital_One (not wd5)
  - ouryahoo.wd5 / careers (NOT yahoo.*)
  - HTTP 422 from a Workday cxs endpoint = wrong/retired tenant, not a body problem. Verify tenants with a live POST; a GET returning 400 does NOT prove the tenant exists.
- Visa: SmartRecruiters public API `api.smartrecruiters.com/v1/companies/Visa/postings` (its `q` param is unreliable — filter client-side). Shopify/Atlassian/Zynga SR boards exist but are empty shells.
- Atlassian: `GET https://www.atlassian.com/endpoint/careers/listings` — full job list JSON (iCIMS-backed).
- Uber: `POST https://www.uber.com/api/loadSearchJobsResults?localeCode=en` with header `x-csrf-token: x`, body `{params:{query},limit,page}`. jobs.uber.com/api/* returns 403.
- Google: no public JSON API; results are server-rendered into `https://www.google.com/about/careers/applications/jobs/results?q=...` — parse anchors `href="jobs/results/{id}-..."` + `aria-label="Learn more about {title}"` + preceding `class="r0wTof"` span for location.

# Still unresolved
- Meta (metacareers.com GraphQL), Intuit (jobs.intuit.com Radancy), Walmart (workday tenant redirects to Workday maintenance page — retired), Shopify, Zynga, IBM (www-api.ibm.com/search/api/v2 rejects naive bodies), Microsoft (gcsservices.careers.microsoft.com is unreachable from this environment, connection fails with status 000).

**How to apply:** when a fetcher for these companies breaks or coverage work resumes (task about unreachable feeds), start from this list instead of re-probing from scratch.
