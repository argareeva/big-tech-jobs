import { Router, type IRouter } from "express";
import {
  ListJobsResponse,
  ListCompaniesResponse,
  RefreshJobsResponse,
  GetJobStatsResponse,
} from "@workspace/api-zod";
import { getJobs, getCompanies, getStats, refreshAll, hasData } from "../lib/jobs/store";
import { sendDigest } from "../lib/email/send-digest";

const router: IRouter = Router();

router.get("/jobs", async (req, res) => {
  if (!hasData()) await refreshAll(req.log);
  const { company, q } = req.query as { company?: string; q?: string };
  res.json(ListJobsResponse.parse(getJobs({ company, q })));
});

router.post("/jobs/refresh", async (req, res) => {
  const summary = await refreshAll(req.log);
  res.json(RefreshJobsResponse.parse(summary));
});

router.get("/jobs/stats", (_req, res) => {
  res.json(GetJobStatsResponse.parse(getStats()));
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
