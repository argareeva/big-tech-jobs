import { Router, type IRouter } from "express";
import {
  ListJobsResponse,
  ListCompaniesResponse,
  RefreshJobsResponse,
  GetJobStatsResponse,
  SetJobAppliedResponse,
} from "@workspace/api-zod";
import { getJobs, getCompanies, getStats, refreshAll, hasData } from "../lib/jobs/store";
import { getAppliedJobIds, getAppliedCount, setApplied } from "../lib/jobs/applied";
import { sendDigest } from "../lib/email/send-digest";

const router: IRouter = Router();

router.get("/jobs", async (req, res) => {
  if (!hasData()) await refreshAll(req.log);
  const { company, q, status } = req.query as { company?: string; q?: string; status?: string };
  const appliedIds = await getAppliedJobIds();
  let all = getJobs({ company, q });
  if (status === "applied") {
    all = all.filter((j) => appliedIds.has(j.id));
  } else if (status !== "all") {
    all = all.filter((j) => !appliedIds.has(j.id));
  }
  res.json(ListJobsResponse.parse(all.map((j) => ({ ...j, applied: appliedIds.has(j.id) }))));
});

router.post("/jobs/applied", async (req, res) => {
  const { jobId, applied } = (req.body ?? {}) as { jobId?: unknown; applied?: unknown };
  if (typeof jobId !== "string" || !jobId || typeof applied !== "boolean") {
    res.status(400).json({ error: "jobId (string) and applied (boolean) are required" });
    return;
  }
  await setApplied(jobId, applied);
  res.json(SetJobAppliedResponse.parse({ jobId, applied }));
});

router.post("/jobs/refresh", async (req, res) => {
  const summary = await refreshAll(req.log);
  res.json(RefreshJobsResponse.parse(summary));
});

router.get("/jobs/stats", async (_req, res) => {
  const appliedIds = await getAppliedJobIds();
  const allJobs = getJobs();
  const openJobs = allJobs.filter((j) => !appliedIds.has(j.id));
  const base = getStats();
  const appliedJobs = await getAppliedCount();
  res.json(
    GetJobStatsResponse.parse({
      ...base,
      totalJobs: openJobs.length,
      companiesWithJobs: new Set(openJobs.map((j) => j.companySlug)).size,
      appliedJobs,
    }),
  );
});

router.get("/companies", (_req, res) => {
  res.json(
    ListCompaniesResponse.parse(
      getCompanies().map((s) => ({
        name: s.config.name,
        slug: s.config.slug,
        ats: s.config.ats,
        programName: s.config.programName,
        programStatus: s.config.programStatus,
        jobCount: s.jobCount,
        lastCheckedAt: s.lastCheckedAt,
        error: s.error,
      })),
    ),
  );
});

router.post("/jobs/digest", async (req, res) => {
  try {
    const result = await sendDigest(req.log);
    res.json({
      ok: true,
      totalJobs: result.totalJobs,
      companiesWithJobs: result.companiesWithJobs,
      emailId: result.emailId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "digest failed");
    res.status(500).json({ ok: false, error: message });
  }
});

export default router;
