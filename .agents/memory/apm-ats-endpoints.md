---
name: APM tracker ATS endpoints
description: Verified per-company careers JSON endpoints and ATS research findings for the APM Radar tracker.
---

## Verified Live Endpoints

| Company | ATS | Config |
|---|---|---|
| LinkedIn, Lyft, Coinbase, Instacart, HubSpot, Block | Greenhouse | `boardSlug` = company name |
| Stripe | Greenhouse | `boardSlug = "stripe"` |
| Databricks | Greenhouse | `boardSlug = "databricks"` — confirmed live APM job (New Grad) |
| Spotify | Lever | `boardSlug = "spotify"` |
| Salesforce | Workday | `host = salesforce.wd12` / `tenant = External_Career_Site` (wd1 and wd5 are dead) |
| Capital One | Workday | `host = capitalone.wd12` / `tenant = Capital_One` |
| Yahoo | Workday | `host = ouryahoo.wd5` / `tenant = careers` |
| PayPal | Workday | `host = paypal.wd1` / `tenant = jobs` / `searchText = "graduate business leadership"` (GBLP program; not currently hiring but feed is live) |
| Visa | SmartRecruiters | `boardSlug = "Visa"` |
| Atlassian | Custom | `GET https://www.atlassian.com/endpoint/careers/listings` |
| Google | Custom HTML | Scrape `/about/careers/applications/jobs/results?q="associate product manager"` |
| Uber | Custom POST | `POST https://www.uber.com/api/loadSearchJobsResults?localeCode=en` + header `x-csrf-token: x` |

## feedUnavailable Companies (confirmed blocked server-side)

| Company | Reason |
|---|---|
| Meta | metacareers.com Relay/GraphQL blocks server-side; doc_id found but endpoint returns Facebook error page |
| Intuit | jobs.intuit.com (Radancy/TalentBrew) returns `{hasJobs:true, results:""}` — no server-side content |
| Walmart | careers.walmart.com is CSR Next.js; all `/api/*` paths serve HTML |
| Shopify | Private Ashby board (401); all Workday tenants 422 |
| Zynga | careers.zynga.com unreachable (000); jobs.zynga.com has no job API |
| IBM | careers.ibm.com returns HTML for all API paths (iCIMS, no public JSON) |
| Microsoft | `gcsservices.careers.microsoft.com` network-unreachable (000); program also paused |
| American Express | ORC (careers.americanexpress.com/hcmRestApi) serves HTML; Avature (aexp.avature.net) network-unreachable (000); Eightfold domain also unreachable |
| JPMorgan Chase | careers.jpmorgan.com is Adobe Experience Manager (AEM); returns HTML for every API path including /api/jobs/search |

## ATS Research Notes

**Why:** Tracks which endpoints were verified or found blocked, so future re-investigation doesn't repeat the same dead ends.

**How to apply:** When adding new companies, check this file first. If a company is listed as feedUnavailable, do not re-attempt the same blocked ATS paths without a new lead (e.g. a DevTools capture from someone with browser access).

**Workday URL pattern:** `https://{host}/wday/cxs/{company}/{tenant}/jobs` — POST with `{"appliedFacets":{},"limit":20,"offset":0,"searchText":"..."}`. Apply URL: `https://{host}/en-US/{tenant}{externalPath}`.

**Greenhouse:** `https://boards-api.greenhouse.io/v1/boards/{boardSlug}/jobs?content=true` — filter by `isApmTitle`.

**Lever:** `https://api.lever.co/v0/postings/{boardSlug}?mode=json` — filter by `isApmTitle`.

**SmartRecruiters:** `https://api.smartrecruiters.com/v1/companies/{boardSlug}/postings?limit=100` — filter by `isApmTitle`.

**AmEx SmartRecruiters:** Board exists (200) but `totalFound: 0` — not their main ATS.

**JPMorgan SmartRecruiters:** Board exists (200) but `totalFound: 0` — not their main ATS for these programs.
