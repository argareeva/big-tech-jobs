---
name: APM tracker ATS endpoints
description: Verified per-company careers JSON endpoints and ATS research findings for the APM Radar tracker.
---

## Microsoft PM Program — confirmed discontinued (not renamed)
Verified via browser network capture against careers.microsoft.com/v2/global/en/programs/students.html
(the official "Early in Profession" programs page): Microsoft lists rotation
programs by name — HR Rotation, Finance Rotation, Cloud Supply Chain Rotation —
and no PM/APM rotation program exists under any name (checked common
successor-brand guesses: "Explore Microsoft", "MACH", "Discovery Program" — all
are either unrelated internship programs or don't exist). The old Microsoft PM
Program (historically "MACH") is genuinely gone, not restructured/renamed.
Re-check this page directly if asked again rather than re-guessing brand names.

## Oracle Recruiting Cloud (ORC) — pattern for career sites that "have no API"
Several large-company careers.* domains (e.g. careers.americanexpress.com,
careers.jpmorgan.com) are just CMS/proxy shells with no visible API — the real
ATS backend lives on a separate `*.fa.oraclecloud.com` host with a `siteNumber`
(e.g. `CX_1`, `CX_1001`), only discoverable via a live browser network capture
(a static curl/HTML read won't reveal it). Query pattern once found:
`https://{host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber={site},keyword="...",limit=100`.
**Important:** ORC's keyword search is fuzzy — it matches individual words
across the whole job corpus, not phrases, and returns thousands of loosely
related results. Always fetch a larger batch and apply an exact-match regex
against `Title` client-side rather than trusting the search ranking.

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
