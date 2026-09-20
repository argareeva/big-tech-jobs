export type Ats = "greenhouse" | "lever" | "workday" | "smartrecruiters" | "oracle" | "ashby" | "custom";

export interface CompanyConfig {
  name: string;
  slug: string;
  ats: Ats;
  programName: string;
  programStatus: "active" | "paused";
  /**
   * When true, this company's career site doesn't expose a usable server-side
   * JSON API (e.g. requires browser auth, returns HTML, or is network-blocked).
   * Fetches are skipped cleanly and the dashboard shows "Feed unavailable".
   */
  feedUnavailable?: true;
  /** Careers/job-search page to link to when there's no fetchable feed, so the user can check manually. */
  careersUrl?: string;
  /**
   * Layer 2 of title matching (see matchesApmTitle in fetchers.ts): literal,
   * case-insensitive substrings that always count as an APM/PM match for
   * this company specifically, regardless of the generic isApmTitle rule.
   * For companies whose real posting title doesn't share wording with the
   * generic qualifier-word pattern (e.g. Jane Street's "Strategy and
   * Product", Figma's "Early Career"). Extend by adding a string here.
   */
  titleAliases?: string[];
  /** Greenhouse/Lever board slug */
  boardSlug?: string;
  /** Ashby job board name, e.g. "Perplexity" in https://api.ashbyhq.com/posting-api/job-board/Perplexity */
  ashbyBoardName?: string;
  /** Workday: host like "meta.wd1.myworkdayjobs.com" and tenant site name */
  workday?: {
    host: string;
    tenant: string;
    company: string;
    /** Override the default "associate product manager" search text */
    searchText?: string;
    /**
     * Exact-match regex applied client-side to titles. Required whenever
     * `searchText` is overridden — Workday's searchText is a fuzzy full-text
     * search (it can match unrelated jobs, e.g. "Sr Machine Learning Engineer"
     * for a "graduate business leadership" query), so results are never
     * trusted purely because they came back from a narrowed search.
     */
    titleMatch?: RegExp;
  };
  /**
   * Oracle Recruiting Cloud (ORC). Note: the public-facing careers.* domain is
   * usually just a proxy/CMS shell — the real API lives on a *.fa.oraclecloud.com
   * host with a siteNumber like "CX_1", found via a browser network capture.
   */
  oracle?: {
    host: string;
    siteNumber: string;
    /** Fuzzy full-text keyword sent to ORC's search (matches individual words, not phrases) */
    keyword: string;
    /** Exact-match regex applied client-side to titles, since ORC's keyword search is fuzzy */
    titleMatch: RegExp;
  };
}

export const COMPANIES: CompanyConfig[] = [
  // Greenhouse
  { name: "LinkedIn", slug: "linkedin", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "linkedin", titleAliases: ["Associate Product Builder"] },
  { name: "Lyft", slug: "lyft", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "lyft" },
  { name: "Coinbase", slug: "coinbase", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "coinbase" },
  { name: "Instacart", slug: "instacart", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "instacart" },
  { name: "HubSpot", slug: "hubspot", ats: "greenhouse", programName: "RPM Program", programStatus: "active", boardSlug: "hubspotjobs" },
  { name: "Block", slug: "block", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "block" },
  // Lever
  { name: "Spotify", slug: "spotify", ats: "lever", programName: "APM Program", programStatus: "active", boardSlug: "spotify", titleAliases: ["Junior Product Manager"] },
  // Plaid migrated off Lever to Ashby (confirmed live via the ATS link on an
  // individual plaid.com/careers/openings/... page, which points at
  // ashbyhq.com/plaid) — re-verified live 2026-09-01, 102 postings, board
  // slug is lowercase "plaid" unlike most Ashby boards.
  { name: "Plaid", slug: "plaid", ats: "ashby", programName: "APM Program", programStatus: "active", ashbyBoardName: "plaid" },
  { name: "Warner Music Group", slug: "wmg", ats: "lever", programName: "APM Program", programStatus: "active", boardSlug: "wmg" },
  // Workday
  // metacareers.com uses a private Relay/GraphQL endpoint that blocks server-side requests
  { name: "Meta", slug: "meta", ats: "custom", programName: "RPM Program", programStatus: "active", feedUnavailable: true, careersUrl: "https://www.metacareers.com/jobs", titleAliases: ["Rotational Product Manager"] },
  { name: "Salesforce", slug: "salesforce", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "salesforce.wd12.myworkdayjobs.com", company: "salesforce", tenant: "External_Career_Site" } },
  // Visa APM Program confirmed closed: SmartRecruiters board returns 200 with
  // totalFound: 0 (the whole company posting list is empty, not just no APM
  // matches) — re-verified live 2026-09-01. Marked paused rather than removed
  // in case it reopens.
  { name: "Visa", slug: "visa", ats: "smartrecruiters", programName: "APM Program", programStatus: "paused", boardSlug: "Visa" },
  // jobs.intuit.com (Radancy/TalentBrew) server-renders full HTML search results —
  // confirmed live via browser network capture; scraped via fetchIntuit (custom).
  { name: "Intuit", slug: "intuit", ats: "custom", programName: "RPM Program", programStatus: "active" },
  // careers.walmart.com shares the same AI job-search assistant GraphQL API used by
  // Sam's Club (POST /api/graphql, persisted query jobSearchAssistant, queryId
  // b0467c1f-f578-4261-9280-0ea4614f251c). Sending "... at Walmart" applies a
  // brand IN ["Walmart"] facet server-side. Confirmed live and server-accessible
  // via plain fetch (no cookies/session/candidateId needed).
  { name: "Walmart", slug: "walmart", ats: "custom", programName: "APM Program", programStatus: "active" },
  // Sam's Club shares Walmart's unified careers.walmart.com site, which is a
  // Next.js/AEM app with an AI job-search assistant backing it: POST
  // https://careers.walmart.com/api/graphql (persisted query "jobSearchAssistant",
  // queryId b0467c1f-f578-4261-9280-0ea4614f251c). Confirmed live and server-accessible
  // via plain curl (no cookies/session/candidateId needed) via browser network capture.
  // Sending a natural-language query mentioning "Sam's Club" makes it apply a
  // brand IN ["Sam's Club"] facet server-side; real Sam's Club Product Management
  // postings come back (e.g. "Senior Product Manager - Membership Engagement").
  { name: "Sam's Club", slug: "samsclub", ats: "custom", programName: "APM Program", programStatus: "active" },
  // Vizio was acquired by Walmart and shares the same unified careers.walmart.com site
  // (POST /api/graphql, queryId b0467c1f-f578-4261-9280-0ea4614f251c). Sending
  // "... at Vizio" applies a brand IN ["Vizio"] facet server-side — re-verified live
  // 2026-08-02 (10 total Vizio jobs returned, brand="Vizio"). Post-acquisition brand
  // consolidation risk: if facet string drifts (e.g. "VIZIO" or "Walmart Technology"),
  // fetchVizio logs a canary warning on 0 APM results. No open APM postings currently
  // (all Senior PM+), but the PM org exists and the feed is functional; 0 is seasonal.
  { name: "Vizio", slug: "vizio", ats: "custom", programName: "APM Program", programStatus: "active" },
  // T-Mobile — Workday tenant confirmed live: POST returns 200 with ~2000 postings.
  { name: "T-Mobile", slug: "tmobile", ats: "workday", programName: "APM Program", programStatus: "active",
    workday: { host: "tmobile.wd1.myworkdayjobs.com", company: "tmobile", tenant: "external" } },
  { name: "Capital One", slug: "capitalone", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "capitalone.wd12.myworkdayjobs.com", company: "capitalone", tenant: "Capital_One" } },
  { name: "Atlassian", slug: "atlassian", ats: "custom", programName: "APM Program", programStatus: "active" },
  // shopify.com/careers is a custom client-rendered app (pre-hydration monitor
  // scripts); no discoverable JSON API in page source or via network capture attempts.
  { name: "Shopify", slug: "shopify", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true, careersUrl: "https://www.shopify.com/careers/search?q=product+manager", titleAliases: ["Apprentice Product Manager"] },
  // zynga.com/careers redirects to a WordPress marketing page (wp-json oembed only,
  // no job search); real application flow (if any) isn't exposed on this domain.
  { name: "Zynga", slug: "zynga", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true, careersUrl: "https://www.zynga.com/job-listing/?department=product-management" },
  // ibm.com/careers/search is Next.js but job results load via a client-side call
  // not present in the SSR payload (__NEXT_DATA__ has no job data) or discoverable in JS bundles.
  { name: "IBM", slug: "ibm", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true, careersUrl: "https://www.ibm.com/careers/search?field_keyword_18[0]=Product%20Management" },
  { name: "Yahoo", slug: "yahoo", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "ouryahoo.wd5.myworkdayjobs.com", company: "ouryahoo", tenant: "careers" } },
  // Microsoft has no cohort APM program. New-grad PMs apply to individual "Program
  // Manager University Grad" postings published seasonally (Aug-Oct main wave, smaller
  // Jan-Mar wave) on apply.careers.microsoft.com (Eightfold AI PCSX). Verified live via
  // fetchMicrosoft(): the search API IS server-accessible via plain HTTP (confirmed via
  // curl, no browser session needed) — 0 postings open right now is a real seasonal gap,
  // not a blocked feed.
  { name: "Microsoft", slug: "microsoft", ats: "custom", programName: "Program Manager University Grad", programStatus: "active" },
  // Custom
  { name: "Google", slug: "google", ats: "custom", programName: "APM Program", programStatus: "active" },
  // Uber migrated its careers site (jobs.uber.com) to a Next.js app on Vercel,
  // which broke the old www.uber.com/api/loadSearchJobsResults endpoint
  // (now 404s). The real backend is Oracle Recruiting Cloud, found via a
  // careers-page network capture: host iaziqy.fa.ocs.oraclecloud.com,
  // siteNumber CX_1. Re-verified live 2026-09-01 (452 total postings for
  // "product manager"; 0 exact APM matches currently, a real seasonal gap).
  { name: "Uber", slug: "uber", ats: "oracle", programName: "APM Program", programStatus: "active",
    oracle: { host: "iaziqy.fa.ocs.oraclecloud.com", siteNumber: "CX_1", keyword: "associate product manager",
      titleMatch: /associate product manager|rotational product manager/i } },
  // Batch 2 additions
  // Stripe — Greenhouse board confirmed live
  { name: "Stripe", slug: "stripe", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "stripe" },
  // Databricks — Greenhouse board confirmed live (1 APM job as of research)
  { name: "Databricks", slug: "databricks", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "databricks" },
  // PayPal — Workday wd1 tenant=jobs; custom searchText to surface GBLP when open.
  // Bug found 2026-09-04: Workday's searchText is fuzzy full-text, not a filter —
  // "graduate business leadership" matched an unrelated "Sr Machine Learning
  // Engineer" posting. Now requires an explicit titleMatch so results are never
  // trusted just because the search returned them.
  { name: "PayPal", slug: "paypal", ats: "workday", programName: "GBLP", programStatus: "active",
    workday: { host: "paypal.wd1.myworkdayjobs.com", company: "paypal", tenant: "jobs", searchText: "graduate business leadership",
      titleMatch: /graduate business leadership|\bgblp\b/i } },
  // American Express — careers.americanexpress.com is a CMS shell; the real ATS is
  // Oracle Recruiting Cloud on egug.fa.us2.oraclecloud.com (siteNumber CX_1),
  // found via browser network capture. Confirmed live; 0 TRP postings open currently.
  { name: "American Express", slug: "amex", ats: "oracle", programName: "TRP", programStatus: "active",
    oracle: { host: "egug.fa.us2.oraclecloud.com", siteNumber: "CX_1", keyword: "talent rotation program", titleMatch: /talent rotation program|\btrp\b/i } },
  // JPMorgan Chase — careers.jpmorgan.com is Adobe Experience Manager (AEM, HTML only),
  // but the actual ATS is Oracle Recruiting Cloud on jpmc.fa.oraclecloud.com
  // (siteNumber CX_1001), found via browser network capture. Confirmed live with
  // real open reqs for the Chase Associate Program.
  { name: "JPMorgan Chase", slug: "jpmorgan", ats: "oracle", programName: "CB Innovation / Chase Associate", programStatus: "active",
    oracle: { host: "jpmc.fa.oraclecloud.com", siteNumber: "CX_1001", keyword: "chase associate program",
      titleMatch: /chase associate program|innovation development program|commercial banking innovation/i } },
  // Batch 3 additions — Greenhouse boards confirmed live
  { name: "Samsara", slug: "samsara", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "samsara" },
  { name: "Figma", slug: "figma", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "figma", titleAliases: ["Early Career"] },
  // StubHub — token is "stubhubinc", not "stubhub" (404s). Careers page is EU-hosted
  // (job-boards.eu.greenhouse.io/stubhubinc) but the standard boards-api.greenhouse.io
  // host still returns 200 with real data for this token; no host override needed.
  { name: "StubHub", slug: "stubhub", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "stubhubinc" },
  // IXL Learning — board also carries sibling-brand postings (e.g. Rosetta Stone)
  // since IXL Learning is the parent company; this is expected, not a wrong token.
  { name: "IXL Learning", slug: "ixl-learning", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "ixllearning" },
  { name: "Roblox", slug: "roblox", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "roblox" },
  { name: "Duolingo", slug: "duolingo", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "duolingo" },
  // Ashby — public posting API confirmed live, no auth needed
  { name: "Perplexity", slug: "perplexity", ats: "ashby", programName: "APM Program", programStatus: "active", ashbyBoardName: "Perplexity" },
  // Batch 4 additions — Ashby boards confirmed live via curl (200 + real postings);
  // 0 current APM/RPM matches for all four is a real seasonal gap, not a broken feed.
  { name: "Ramp", slug: "ramp", ats: "ashby", programName: "APM Program", programStatus: "active", ashbyBoardName: "Ramp" },
  { name: "Notion", slug: "notion", ats: "ashby", programName: "APM Program", programStatus: "active", ashbyBoardName: "Notion" },
  { name: "Linear", slug: "linear", ats: "ashby", programName: "APM Program", programStatus: "active", ashbyBoardName: "Linear" },
  { name: "Vanta", slug: "vanta", ats: "ashby", programName: "APM Program", programStatus: "active", ashbyBoardName: "Vanta" },
  // Batch 5 additions — investigated a hypothesis that Disney/BlackRock/New Balance/
  // Adobe/Warner Bros. Discovery/PNC (all sharing a "/global/en/job/{code}/{id}"
  // career URL) ran on a shared Oracle Fusion Cloud Recruiting backend. Disproven:
  // PNC/Adobe/WBD/New Balance are Phenom People CMS skins over real Workday tenants
  // (confirmed live below); Disney/BlackRock are TalentBrew (Radancy), not Oracle.
  { name: "PNC", slug: "pnc", ats: "workday", programName: "APM Program", programStatus: "active",
    workday: { host: "pnc.wd5.myworkdayjobs.com", company: "pnc", tenant: "External" } },
  { name: "Adobe", slug: "adobe", ats: "workday", programName: "APM Program", programStatus: "active",
    workday: { host: "adobe.wd5.myworkdayjobs.com", company: "adobe", tenant: "external_experienced" } },
  { name: "Warner Bros. Discovery", slug: "wbd", ats: "workday", programName: "APM Program", programStatus: "active",
    workday: { host: "warnerbros.wd5.myworkdayjobs.com", company: "warnerbros", tenant: "global" } },
  { name: "New Balance", slug: "new-balance", ats: "workday", programName: "APM Program", programStatus: "active",
    workday: { host: "newbalance.wd1.myworkdayjobs.com", company: "newbalance", tenant: "Careers" } },
  // www.disneycareers.com (TalentBrew/Radancy, not Oracle) server-renders full HTML
  // search results — confirmed live; scraped via fetchDisney (custom), modeled on
  // the existing fetchIntuit TalentBrew scraper. Migrated from jobs.disneycareers.com
  // (old host now 301s to the bare homepage) — confirmed 2026-09-08.
  { name: "Disney", slug: "disney", ats: "custom", programName: "APM Program", programStatus: "active" },
  // careers.blackrock.com is also TalentBrew, but its job list loads via a
  // session-scoped AJAX module call (data-ajax-url="/module/postmodule") that
  // returns a redirect on a stateless request — not reliably fetchable without a
  // real browser session. Left unavailable pending future investigation.
  { name: "BlackRock", slug: "blackrock", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true, careersUrl: "https://careers.blackrock.com/search-jobs" },
  // Batch 6 additions — sourced from apmlist.com, full-time entries only
  // (its "Open PM Internships" table was skipped entirely per the no-internship rule).
  // All boards below confirmed live via curl 2026-08-03; 0 current APM matches for
  // several is a real seasonal gap (same as several existing companies), not a
  // broken feed — each returns hundreds of real postings, just none APM-titled today.
  { name: "OKX", slug: "okx", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "okx" },
  { name: "Reddit", slug: "reddit", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "reddit" },
  { name: "Robinhood", slug: "robinhood", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "robinhood" },
  { name: "Scale AI", slug: "scaleai", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "scaleai" },
  { name: "Dropbox", slug: "dropbox", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "dropbox" },
  { name: "Pinterest", slug: "pinterest", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "pinterest" },
  // DoorDash's Greenhouse token is "doordashusa", not "doordash" (404s).
  { name: "DoorDash", slug: "doordash", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "doordashusa" },
  { name: "Asana", slug: "asana", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "asana" },
  { name: "Arcade AI", slug: "arcade-ai", ats: "ashby", programName: "APM Program", programStatus: "active", ashbyBoardName: "arcade-ai" },
  // Sierra's product/engineering new-grad program is branded "APX", so its
  // title does not contain the usual product/program keywords.
  { name: "Sierra AI", slug: "sierra-ai", ats: "ashby", programName: "APM Program", programStatus: "active", ashbyBoardName: "Sierra", titleAliases: ["APX (New Grad"] },
  { name: "Kleiner Perkins Fellows", slug: "kp-fellows", ats: "ashby", programName: "Fellows Program", programStatus: "active", ashbyBoardName: "KleinerPerkinsFellows", titleAliases: ["Product Fellow"] },
  // Red Hat — Workday tenant confirmed live: POST returns 200 with real postings
  // (company=redhat, tenant=jobs; not the more common "External"/"Careers" tenant names).
  { name: "Red Hat", slug: "redhat", ats: "workday", programName: "APM Program", programStatus: "active",
    workday: { host: "redhat.wd5.myworkdayjobs.com", company: "redhat", tenant: "jobs" } },
  // Oracle — same Oracle Recruiting Cloud backend pattern as American Express/JPMorgan,
  // but this is Oracle's own careers site (eeho.fa.us2.oraclecloud.com, siteNumber CX_1).
  // Confirmed live; 0 current matches.
  { name: "Oracle", slug: "oracle", ats: "oracle", programName: "APM Program", programStatus: "active",
    oracle: { host: "eeho.fa.us2.oraclecloud.com", siteNumber: "CX_1", keyword: "associate product manager", titleMatch: /associate product manager|rotational product manager/i } },
  // Mastercard — careers.mastercard.com is a Phenom People CMS skin over a real
  // Workday tenant (host mastercard.wd1.myworkdayjobs.com, site CorporateCareers),
  // found via a live job page's apply link. Confirmed live: POST returns 200 with
  // real postings, including "Associate Product Specialist, Product Management"
  // (found 2026-09-08 from a user-supplied job link). The default fetchWorkday
  // searchText ("associate product manager") doesn't surface that posting in its
  // top 20 fuzzy-ranked results — searchText "associate product" does (confirmed
  // live). isApmTitle (broadened the same day) does the actual title filtering,
  // so this override only widens the candidate pool, same PayPal-style pattern.
  { name: "Mastercard", slug: "mastercard", ats: "workday", programName: "APM Program", programStatus: "active",
    workday: { host: "mastercard.wd1.myworkdayjobs.com", company: "mastercard", tenant: "CorporateCareers", searchText: "associate product" } },
  // Batch 7 additions — sourced from the two-layer title-matching request's
  // explicit per-company alias list (companies not previously tracked).
  // Palo Alto Networks — Workday tenant found via a live careers-page fetch
  // (jobs.paloaltonetworks.com references paloaltonetworks.wd5.myworkdayjobs.com
  // directly). Confirmed live 2026-09-08: POST returns 200 with real postings.
  // Default searchText widened to "product management" so an "Academy" cohort
  // posting (not literally "associate product manager") would surface in the
  // candidate pool; 0 current Academy postings is a real seasonal gap, not a
  // broken feed — the search itself returns hundreds of unrelated real jobs.
  { name: "Palo Alto Networks", slug: "palo-alto-networks", ats: "workday", programName: "Product Management Academy", programStatus: "active",
    workday: { host: "paloaltonetworks.wd5.myworkdayjobs.com", company: "paloaltonetworks", tenant: "panwexternalcareers", searchText: "product management" },
    titleAliases: ["Product Management Academy"] },
  // Experian — jobs.experian.com redirects to a SmartRecruiters-backed board
  // (company identifier "Experian", confirmed via an apply-link on the live
  // careers page). Confirmed live 2026-09-08: 450 total postings, real
  // "Product Management"-titled roles present; 0 current "Xcelerator Rotation
  // Program" postings is a real seasonal gap.
  { name: "Experian", slug: "experian", ats: "smartrecruiters", programName: "Product Management Xcelerator Rotation Program", programStatus: "active",
    boardSlug: "Experian", titleAliases: ["Product Management Xcelerator Rotation Program"] },
  // Jane Street — join-jane-street/open-roles page is server-rendered from a
  // plain JSON feed (www.janestreet.com/jobs/main.json, no auth), found by
  // fetching the page's own open_positions JS bundle and grep'ing for a
  // ".json" reference. Confirmed live 2026-09-08 (232 total postings). Custom
  // fetcher (fetchJaneStreet) is required, not the generic ones, because the
  // feed has no company/keyword filter server-side and — notably — an
  // internship posting there is NOT distinguishable by title text alone (e.g.
  // "Strategy and Product" is used for both the internship and full-time
  // role); the internship signal lives in a separate `availability` field
  // ("Summer Internship" vs "Full-Time: Experienced"), which the fetcher
  // checks instead of relying on isInternshipTitle for this company.
  { name: "Jane Street", slug: "janestreet", ats: "custom", programName: "Strategy and Product", programStatus: "active",
    titleAliases: ["Strategy and Product"] },
  // Apple — jobs.apple.com is a client-rendered React app. Earlier passes
  // guessed the wrong endpoint path (POST /api/v1/search/search, a typo of
  // the real /api/v1/search) and the wrong payload shape, both of which
  // produced 401/436 errors that looked like a session/bot-protection lock.
  // Reading the site's own JS bundle (jobsite.main.*.js, `const c = {
  // csrf:{token:{url:"/api/v1/CSRFToken"}}, search:{search:{url:"/api/v1/search"}} }`
  // and the request-builder function that calls `.search.search.post`)
  // revealed the real path and body shape. It works with a plain session:
  // GET the search page for a `jobs` cookie, GET /api/v1/CSRFToken for a
  // token (sent back as X-Apple-CSRF-Token), then POST /api/v1/search with
  // `{query, filters, page, locale, sort, format}`. No login/candidate auth
  // needed — see fetchApple in fetchers.ts.
  { name: "Apple", slug: "apple", ats: "custom", programName: "Product Manager", programStatus: "active",
    careersUrl: "https://jobs.apple.com/en-us/search?search=product%20manager" },
];
