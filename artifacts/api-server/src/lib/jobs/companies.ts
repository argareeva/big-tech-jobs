export type Ats = "greenhouse" | "lever" | "workday" | "smartrecruiters" | "custom";

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
  /** Workday: host like "meta.wd1.myworkdayjobs.com" and tenant site name */
  workday?: { host: string; tenant: string; company: string };
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
  // Workday
  // metacareers.com uses a private Relay/GraphQL endpoint that blocks server-side requests
  { name: "Meta", slug: "meta", ats: "custom", programName: "RPM Program", programStatus: "active", feedUnavailable: true },
  { name: "Salesforce", slug: "salesforce", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "salesforce.wd12.myworkdayjobs.com", company: "salesforce", tenant: "External_Career_Site" } },
  { name: "Visa", slug: "visa", ats: "smartrecruiters", programName: "APM Program", programStatus: "active", boardSlug: "Visa" },
  // jobs.intuit.com (Radancy/TalentBrew) returns hasJobs:true but empty results server-side
  { name: "Intuit", slug: "intuit", ats: "custom", programName: "RPM Program", programStatus: "active", feedUnavailable: true },
  // careers.walmart.com is a Next.js CSR app with no public JSON API
  { name: "Walmart", slug: "walmart", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true },
  { name: "Capital One", slug: "capitalone", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "capitalone.wd12.myworkdayjobs.com", company: "capitalone", tenant: "Capital_One" } },
  { name: "Atlassian", slug: "atlassian", ats: "custom", programName: "APM Program", programStatus: "active" },
  // Shopify uses a private Ashby board (401); no Workday tenant responds 
  { name: "Shopify", slug: "shopify", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true },
  // careers.zynga.com is unreachable; jobs.zynga.com has no job-search API
  { name: "Zynga", slug: "zynga", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true },
  // careers.ibm.com returns HTML for all API paths (iCIMS, no public JSON endpoint)
  { name: "IBM", slug: "ibm", ats: "custom", programName: "APM Program", programStatus: "active", feedUnavailable: true },
  { name: "Yahoo", slug: "yahoo", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "ouryahoo.wd5.myworkdayjobs.com", company: "ouryahoo", tenant: "careers" } },
  // gcsservices.careers.microsoft.com is network-unreachable from server-side; program is also paused
  { name: "Microsoft", slug: "microsoft", ats: "custom", programName: "Microsoft PM Program", programStatus: "paused", feedUnavailable: true },
  // Custom
  { name: "Google", slug: "google", ats: "custom", programName: "APM Program", programStatus: "active" },
  { name: "Uber", slug: "uber", ats: "custom", programName: "APM Program", programStatus: "active" },
];
