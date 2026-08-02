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
  { name: "LinkedIn", slug: "linkedin", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "linkedin" },
  { name: "Lyft", slug: "lyft", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "lyft" },
  { name: "Coinbase", slug: "coinbase", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "coinbase" },
  { name: "Instacart", slug: "instacart", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "instacart" },
  { name: "HubSpot", slug: "hubspot", ats: "greenhouse", programName: "RPM Program", programStatus: "active", boardSlug: "hubspotjobs" },
  { name: "Block", slug: "block", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "block" },
  // Lever
  { name: "Spotify", slug: "spotify", ats: "lever", programName: "APM Program", programStatus: "active", boardSlug: "spotify" },
  { name: "Plaid", slug: "plaid", ats: "lever", programName: "APM Program", programStatus: "active", boardSlug: "plaid" },
  { name: "Warner Music Group", slug: "wmg", ats: "lever", programName: "APM Program", programStatus: "active", boardSlug: "wmg" },
  // Workday
  // metacareers.com uses a private Relay/GraphQL endpoint that blocks server-side requests
  { name: "Meta", slug: "meta", ats: "custom", programName: "RPM Program", programStatus: "active", feedUnavailable: true },
  { name: "Salesforce", slug: "salesforce", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "salesforce.wd12.myworkdayjobs.com", company: "salesforce", tenant: "External_Career_Site" } },
  { name: "Visa", slug: "visa", ats: "smartrecruiters", programName: "APM Program", programStatus: "active", boardSlug: "Visa" },
  // jobs.intuit.com (Radancy/TalentBrew) server-renders full HTML search results —
  // confirmed live via browser network capture; scraped via fetchIntuit (custom).
  { name: "Intuit", slug: "intuit", ats: "custom", programName: "RPM Program", programStatus: "active" },
  // careers.walmart.com is a Next.js CSR app (no JSON in initial HTML); the legacy
  // walmart.wd5.myworkdayjobs.com/WalmartExternal Workday tenant now 404s/loops —
  // Walmart appears to have migrated off that Workday site with no public replacement found.
  { name: "Walmart", slug: "walmart", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true },
  // Sam's Club was expected to share Walmart's Workday tenant (walmart.wd5.myworkdayjobs.com),
  // but that tenant is confirmed dead (every plausible tenant name — WalmartExternal, Walmart,
  // External, Careers, WalmartCareers — returns HTTP 303 redirect-to-nowhere) and
  // careers.walmart.com itself is unreachable. Sam's Club's actual ATS is unknown; needs a
  // future browser-based network capture to find it. Not fabricating a working endpoint here.
  { name: "Sam's Club", slug: "samsclub", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true },
  // T-Mobile — Workday tenant confirmed live: POST returns 200 with ~2000 postings.
  { name: "T-Mobile", slug: "tmobile", ats: "workday", programName: "APM Program", programStatus: "active",
    workday: { host: "tmobile.wd1.myworkdayjobs.com", company: "tmobile", tenant: "external" } },
  { name: "Capital One", slug: "capitalone", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "capitalone.wd12.myworkdayjobs.com", company: "capitalone", tenant: "Capital_One" } },
  { name: "Atlassian", slug: "atlassian", ats: "custom", programName: "APM Program", programStatus: "active" },
  // shopify.com/careers is a custom client-rendered app (pre-hydration monitor
  // scripts); no discoverable JSON API in page source or via network capture attempts.
  { name: "Shopify", slug: "shopify", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true },
  // zynga.com/careers redirects to a WordPress marketing page (wp-json oembed only,
  // no job search); real application flow (if any) isn't exposed on this domain.
  { name: "Zynga", slug: "zynga", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true },
  // ibm.com/careers/search is Next.js but job results load via a client-side call
  // not present in the SSR payload (__NEXT_DATA__ has no job data) or discoverable in JS bundles.
  { name: "IBM", slug: "ibm", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true },
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
  { name: "Uber", slug: "uber", ats: "custom", programName: "APM Program", programStatus: "active" },
  // Batch 2 additions
  // Stripe — Greenhouse board confirmed live
  { name: "Stripe", slug: "stripe", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "stripe" },
  // Databricks — Greenhouse board confirmed live (1 APM job as of research)
  { name: "Databricks", slug: "databricks", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "databricks" },
  // PayPal — Workday wd1 tenant=jobs; custom searchText to surface GBLP when open
  { name: "PayPal", slug: "paypal", ats: "workday", programName: "GBLP", programStatus: "active",
    workday: { host: "paypal.wd1.myworkdayjobs.com", company: "paypal", tenant: "jobs", searchText: "graduate business leadership" } },
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
  { name: "Figma", slug: "figma", ats: "greenhouse", programName: "APM Program", programStatus: "active", boardSlug: "figma" },
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
];
