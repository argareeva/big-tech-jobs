/**
 * Core email-digest logic — shared between the HTTP route handler
 * and the standalone digest entrypoint.
 */
import { Resend } from "resend";
import { COMPANIES } from "../jobs/companies.js";
import { fetchForCompany, FEED_UNAVAILABLE, type NormalizedJob } from "../jobs/fetchers.js";

export interface DigestResult {
  totalJobs: number;
  companiesWithJobs: number;
  emailId: string | null;
}

export async function sendDigest(log?: {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}): Promise<DigestResult> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;

  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  if (!NOTIFY_EMAIL) throw new Error("NOTIFY_EMAIL is not set");

  // ── Fetch all available feeds ────────────────────────────────────────────
  const byCompany = new Map<string, { name: string; jobs: NormalizedJob[] }>();

  await Promise.all(
    COMPANIES.map(async (c) => {
      if (c.feedUnavailable || c.programStatus === "paused") return;
      try {
        const result = await fetchForCompany(c);
        if (result === FEED_UNAVAILABLE) return;
        if (result.length > 0) byCompany.set(c.slug, { name: c.name, jobs: result });
        log?.info({ company: c.slug, count: result.length }, "digest fetch");
      } catch (err) {
        log?.warn({ company: c.slug, err }, "digest fetch failed");
      }
    }),
  );

  const totalJobs = [...byCompany.values()].reduce((n, v) => n + v.jobs.length, 0);

  // ── Build HTML ────────────────────────────────────────────────────────────
  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  const sortedCompanies = [...byCompany.entries()].sort(([, a], [, b]) =>
    a.name.localeCompare(b.name),
  );

  const companySections =
    sortedCompanies.length === 0
      ? `
        <div style="text-align:center;padding:24px 0;color:#6b7280;">
          <div style="font-size:15px;font-weight:600;color:#0f172a;margin-bottom:6px;">No open APM/RPM roles today</div>
          <div style="font-size:13px;">Checked every tracked company's careers page — nothing currently open. You'll hear from us again tomorrow.</div>
        </div>`
      : sortedCompanies
          .map(([, { name, jobs }]) => {
            const rows = jobs
              .map(
                (j) => `
                <li style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f0f0f0;">
                  <a href="${esc(j.applyUrl)}" style="color:#f97316;font-weight:600;text-decoration:none;font-size:15px;">${esc(j.title)}</a>
                  <div style="color:#6b7280;font-size:13px;margin-top:3px;">📍 ${esc(j.location || "Location not specified")}</div>
                </li>`,
              )
              .join("");

            return `
              <div style="margin-bottom:32px;">
                <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0f172a;
                           border-left:4px solid #f97316;padding-left:12px;">
                  ${esc(name)}
                  <span style="font-size:13px;font-weight:400;color:#6b7280;margin-left:8px;">
                    ${jobs.length} open role${jobs.length !== 1 ? "s" : ""}
                  </span>
                </h2>
                <ul style="list-style:none;margin:0;padding:0;">${rows}</ul>
              </div>`;
          })
          .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>APM Radar · ${esc(todayStr)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;">
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
        APM <span style="color:#f97316;">Radar</span>
      </div>
      <div style="color:#94a3b8;font-size:14px;margin-top:4px;">Morning Digest · ${esc(todayStr)}</div>
    </div>
    <div style="background:#f97316;padding:16px 40px;">
      <span style="display:inline-block;margin-right:32px;">
        <div style="font-size:28px;font-weight:800;color:#fff;">${totalJobs}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.5px;">Open Positions</div>
      </span>
      <span style="display:inline-block;">
        <div style="font-size:28px;font-weight:800;color:#fff;">${byCompany.size}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.5px;">Companies Hiring</div>
      </span>
    </div>
    <div style="padding:32px 40px;">${companySections}</div>
    <div style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
      Sent daily at 8 AM by APM Radar · Only roles currently listed on each company's careers page are included.
    </div>
  </div>
</body>
</html>`;

  // ── Send ────────────────────────────────────────────────────────────────
  const resend = new Resend(RESEND_API_KEY);
  const dateShort = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const subject =
    totalJobs === 0
      ? `APM Radar: no open roles today (${dateShort})`
      : `APM Radar: ${totalJobs} open role${totalJobs !== 1 ? "s" : ""} today (${dateShort})`;

  const { data, error } = await resend.emails.send({
    from: "APM Radar <onboarding@resend.dev>",
    to: [NOTIFY_EMAIL],
    subject,
    html,
  });

  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);

  return {
    totalJobs,
    companiesWithJobs: byCompany.size,
    emailId: data?.id ?? null,
  };
}
