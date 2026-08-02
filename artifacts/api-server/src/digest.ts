/**
 * APM Radar — Morning Digest (standalone entrypoint)
 *
 * Used by Replit Scheduled Deployments.
 * Runs a fresh fetch of all available ATS feeds, then sends
 * a clean HTML digest via Resend to NOTIFY_EMAIL. Always sends an email —
 * even a "no open roles today" one — so a silent failure never looks the
 * same as a quiet day.
 *
 * A per-company fetch failure is logged and that company's section is
 * skipped; it never blocks the rest of the digest (see sendDigest).
 *
 * Exits 0 on success, exits 1 only if the digest itself couldn't be built
 * or sent (e.g. missing secrets, Resend API error).
 */
import { sendDigest } from "./lib/email/send-digest.js";

const log = {
  info: (obj: unknown, msg?: string) => console.log(msg ?? "", obj),
  warn: (obj: unknown, msg?: string) => console.warn(msg ?? "", obj),
};

console.log("APM Radar: starting morning digest…");

try {
  const result = await sendDigest(log);
  console.log(
    `Digest sent. ${result.totalJobs} roles across ${result.companiesWithJobs} companies. Resend ID: ${result.emailId}`,
  );
  process.exit(0);
} catch (err) {
  console.error("Digest failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
