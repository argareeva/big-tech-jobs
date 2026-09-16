---
name: APM tracker closed-job detection
description: Principle for deciding a persisted applied/not-interested job is "closed" vs. "no live data yet" — check before touching closed-detection logic.
---

Applied/not-interested jobs are persisted independently of the live feed. Whether one of
those rows is "closed" must NOT be derived purely from "missing from the current live
feed snapshot" — the live feed can be empty or partial for reasons that have nothing to
do with the job actually closing (a refresh that hasn't run yet, every fetch for a
company failing, or a bug wiping the in-memory data).

**Why:** a single global "have we ever refreshed" flag isn't enough — it can be true even
when the refresh returned nothing useful (all fetches failed, or every fetch "succeeded"
but returned zero results due to a bug). Confirming closure requires two independent
signals to both hold: the live feed as a whole has real data, and the specific job's
source was itself fetched successfully. Missing either signal means "unknown," not
"closed" — err toward keeping a posting visible over wrongly hiding it.

**How to apply:** any future change to closed-detection or to how fetch success/failure
is tracked must preserve both checks (overall feed health + per-source fetch success),
not fall back to either one alone.
