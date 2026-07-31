export type Ats = "greenhouse" | "lever" | "workday" | "smartrecruiters" | "custom";

export interface CompanyConfig {
  name: string;
  slug: string;
  ats: Ats;
  programName: string;
  programStatus: "active" | "paused";
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
  { name: "Meta", slug: "meta", ats: "workday", programName: "RPM Program", programStatus: "active", workday: { host: "meta.wd1.myworkdayjobs.com", company: "meta", tenant: "Meta_External_Site" } },
  { name: "Salesforce", slug: "salesforce", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "salesforce.wd1.myworkdayjobs.com", company: "salesforce", tenant: "External_Career_Site" } },
  { name: "Visa", slug: "visa", ats: "smartrecruiters", programName: "APM Program", programStatus: "active", boardSlug: "Visa" },
  { name: "Intuit", slug: "intuit", ats: "workday", programName: "RPM Program", programStatus: "active", workday: { host: "intuit.wd5.myworkdayjobs.com", company: "intuit", tenant: "External_Career_Site" } },
  { name: "Walmart", slug: "walmart", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "walmart.wd5.myworkdayjobs.com", company: "walmart", tenant: "WalmartExternalCareers" } },
  { name: "Capital One", slug: "capitalone", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "capitalone.wd12.myworkdayjobs.com", company: "capitalone", tenant: "Capital_One" } },
  { name: "Atlassian", slug: "atlassian", ats: "custom", programName: "APM Program", programStatus: "active" },
  { name: "Shopify", slug: "shopify", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "shopify.wd5.myworkdayjobs.com", company: "shopify", tenant: "Shopify" } },
  { name: "Zynga", slug: "zynga", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "zynga.wd1.myworkdayjobs.com", company: "zynga", tenant: "Zynga_External" } },
  { name: "IBM", slug: "ibm", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "ibm.wd3.myworkdayjobs.com", company: "ibm", tenant: "IBMExternalSite" } },
  { name: "Yahoo", slug: "yahoo", ats: "workday", programName: "APM Program", programStatus: "active", workday: { host: "ouryahoo.wd5.myworkdayjobs.com", company: "ouryahoo", tenant: "careers" } },
  { name: "Microsoft", slug: "microsoft", ats: "workday", programName: "Microsoft PM Program", programStatus: "paused", workday: { host: "microsoft.wd1.myworkdayjobs.com", company: "microsoft", tenant: "External_Career_Site" } },
  // Custom
  { name: "Google", slug: "google", ats: "custom", programName: "APM Program", programStatus: "active" },
  { name: "Uber", slug: "uber", ats: "custom", programName: "APM Program", programStatus: "active" },
];
