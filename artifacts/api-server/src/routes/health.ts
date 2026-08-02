import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { probeWalmartQueryId } from "../lib/jobs/fetchers.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * GET /api/healthz/walmart-queryid
 *
 * Verifies the careers.walmart.com persisted GraphQL query ID is still valid
 * by sending a probe request and asserting at least one job is returned.
 * Returns 200 { status: "ok" } when healthy, 503 { status: "degraded",
 * message: "..." } when the queryId appears to have rotated or the API shape
 * has changed. Call this endpoint to get an early warning before all three
 * Walmart-family feeds (Walmart, Sam's Club, Vizio) go dark.
 */
router.get("/healthz/walmart-queryid", async (_req, res) => {
  try {
    await probeWalmartQueryId();
    res.json({ status: "ok" });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
