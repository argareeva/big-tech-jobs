import { Router, type IRouter } from "express";
import {
  ListJobsResponse,
  ListCompaniesResponse,
  RefreshJobsResponse,
  GetJobStatsResponse,
  SetJobAppliedResponse,
  SetJobNotInterestedResponse,
} from "@workspace/api-zod";
import { getJobs, getCompanies, getStats, refreshAll, hasData } from "../lib/jobs/store";
import {
  getAppliedJobIds,
  getAppliedJobs,
  getAppliedCompanySlugs,
  getAppliedCount,
  setApplied,
} from "../lib/jobs/applied";
import {
  getNotInterestedJobIds,
  getNotInterestedJobs,
  getNotInterestedCount,
  setNotInterested,
} from "../lib/jobs/not-interested";
import { sendDigest } from "../lib/email/send-digest";

const router: IRouter = Router();

router.get("/jobs", async (req, res) => {
  if (!hasData()) await refreshAll(req.log);
  const { company, q, status } = req.query as { company?: string; q?: string; status?: string };
  const appliedIds = await getAppliedJobIds();
  const notInterestedIds = await getNotInterestedJobIds();

  if (status === "applied") {
    // Applied jobs are persisted independently of the live feed, so a
    // closed posting still shows up here (flagged as closed) instead of
    // silently disappearing once the company's feed drops it.
    const liveById = new Map(getJobs({ company, q }).map((j) => [j.id, j]));
    let appliedJobs = await getAppliedJobs();
    if (company) appliedJobs = appliedJobs.filter((a) => a.companySlug === company);
    if (q) {
      const needle = q.toLowerCase();
      appliedJobs = appliedJobs.filter((a) => a.title.toLowerCase().includes(needle));
    }
    const result = appliedJobs
      .map((a) => {
        const live = liveById.get(a.jobId);
        return {
          id: a.jobId,
          title: live?.title ?? a.title,
          company: live?.company ?? a.company,
          companySlug: live?.companySlug ?? a.companySlug,
          location: live?.location ?? a.location,
          applyUrl: live?.applyUrl ?? a.applyUrl,
          source: live?.source ?? a.source,
          postedOn: live?.postedOn ?? a.postedOn ?? null,
          applied: true,
          notInterested: notInterestedIds.has(a.jobId),
          closed: !live,
        };
      })
      .sort((a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title));
    res.json(ListJobsResponse.parse(result));
    return;
  }

  if (status === "not_interested") {
    // Not-interested jobs are persisted independently of the live feed, so
    // a closed posting still shows up here (flagged as closed) instead of
    // silently disappearing once the company's feed drops it.
    // liveById is unfiltered by company/q — a dismissed job whose live
    // posting no longer matches the current filters (e.g. it's closed) must
    // still be looked up so we can tell it apart from one that never had a
    // snapshot at all.
    const liveById = new Map(getJobs().map((j) => [j.id, j]));
    let dismissedJobs = await getNotInterestedJobs();
    if (company) {
      dismissedJobs = dismissedJobs.filter(
        (d) => (d.companySlug ?? liveById.get(d.jobId)?.companySlug) === company,
      );
    }
    if (q) {
      const needle = q.toLowerCase();
      dismissedJobs = dismissedJobs.filter((d) =>
        (d.title ?? liveById.get(d.jobId)?.title ?? "").toLowerCase().includes(needle),
      );
    }
    const result = dismissedJobs
      .map((d) => {
        const live = liveById.get(d.jobId);
        // Rows dismissed before the snapshot feature shipped have no
        // stored details. If the live posting is also gone, fall back to
        // placeholders rather than fabricating data — the row still stays
        // suppressed either way.
        return {
          id: d.jobId,
          title: live?.title ?? d.title ?? "(details unavailable)",
          company: live?.company ?? d.company ?? "(details unavailable)",
          companySlug: live?.companySlug ?? d.companySlug ?? "",
          location: live?.location ?? d.location ?? "(details unavailable)",
          applyUrl: live?.applyUrl ?? d.applyUrl ?? "",
          source: live?.source ?? d.source ?? "unknown",
          postedOn: live?.postedOn ?? d.postedOn ?? null,
          applied: appliedIds.has(d.jobId),
          notInterested: true,
          closed: !live,
        };
      })
      .sort((a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title));
    res.json(ListJobsResponse.parse(result));
    return;
  }

  let all = getJobs({ company, q });
  if (status !== "all") {
    all = all.filter((j) => !appliedIds.has(j.id) && !notInterestedIds.has(j.id));
  }
  res.json(
    ListJobsResponse.parse(
      all.map((j) => ({
        ...j,
        applied: appliedIds.has(j.id),
        notInterested: notInterestedIds.has(j.id),
        closed: false,
      })),
    ),
  );
});

router.post("/jobs/applied", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { jobId, applied } = body as { jobId?: unknown; applied?: unknown };
  if (typeof jobId !== "string" || !jobId || typeof applied !== "boolean") {
    res.status(400).json({ error: "jobId (string) and applied (boolean) are required" });
    return;
  }
  if (applied) {
    const { title, company, companySlug, location, applyUrl, source } = body as Record<
      string,
      unknown
    >;
    if (
      typeof title !== "string" ||
      !title ||
      typeof company !== "string" ||
      !company ||
      typeof companySlug !== "string" ||
      !companySlug ||
      typeof location !== "string" ||
      !location ||
      typeof applyUrl !== "string" ||
      !applyUrl ||
      typeof source !== "string" ||
      !source
    ) {
      res.status(400).json({
        error:
          "title, company, companySlug, location, applyUrl, and source (all strings) are required when applied is true",
      });
      return;
    }
    const postedOn = typeof body.postedOn === "string" ? body.postedOn : null;
    await setApplied(jobId, true, {
      jobId,
      title,
      company,
      companySlug,
      location,
      applyUrl,
      source,
      postedOn,
    });
  } else {
    await setApplied(jobId, false);
  }
  res.json(SetJobAppliedResponse.parse({ jobId, applied }));
});

router.post("/jobs/not-interested", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { jobId, notInterested } = body as { jobId?: unknown; notInterested?: unknown };
  if (typeof jobId !== "string" || !jobId || typeof notInterested !== "boolean") {
    res.status(400).json({ error: "jobId (string) and notInterested (boolean) are required" });
    return;
  }
  if (notInterested) {
    const { title, company, companySlug, location, applyUrl, source } = body as Record<
      string,
      unknown
    >;
    if (
      typeof title !== "string" ||
      !title ||
      typeof company !== "string" ||
      !company ||
      typeof companySlug !== "string" ||
      !companySlug ||
      typeof location !== "string" ||
      !location ||
      typeof applyUrl !== "string" ||
      !applyUrl ||
      typeof source !== "string" ||
      !source
    ) {
      res.status(400).json({
        error:
          "title, company, companySlug, location, applyUrl, and source (all strings) are required when notInterested is true",
      });
      return;
    }
    const postedOn = typeof body.postedOn === "string" ? body.postedOn : null;
    await setNotInterested(jobId, true, {
      jobId,
      title,
      company,
      companySlug,
      location,
      applyUrl,
      source,
      postedOn,
    });
  } else {
    await setNotInterested(jobId, false);
  }
  res.json(SetJobNotInterestedResponse.parse({ jobId, notInterested }));
});

router.post("/jobs/refresh", async (req, res) => {
  const summary = await refreshAll(req.log);
  res.json(RefreshJobsResponse.parse(summary));
});

router.get("/jobs/stats", async (_req, res) => {
  const appliedIds = await getAppliedJobIds();
  const notInterestedIds = await getNotInterestedJobIds();
  const allJobs = getJobs();
  const openJobs = allJobs.filter((j) => !appliedIds.has(j.id) && !notInterestedIds.has(j.id));
  const base = getStats();
  const appliedJobs = await getAppliedCount();
  const notInterestedJobs = await getNotInterestedCount();
  res.json(
    GetJobStatsResponse.parse({
      ...base,
      totalJobs: openJobs.length,
      companiesWithJobs: new Set(openJobs.map((j) => j.companySlug)).size,
      appliedJobs,
      notInterestedJobs,
    }),
  );
});

router.get("/companies", async (_req, res) => {
  const appliedCompanySlugs = await getAppliedCompanySlugs();
  res.json(
    ListCompaniesResponse.parse(
      getCompanies().map((s) => ({
        name: s.config.name,
        slug: s.config.slug,
        ats: s.config.ats,
        programName: s.config.programName,
        programStatus: s.config.programStatus,
        jobCount: s.jobCount,
        hasApplied: appliedCompanySlugs.has(s.config.slug),
        lastCheckedAt: s.lastCheckedAt,
        error: s.error,
        careersUrl: s.config.careersUrl ?? null,
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
