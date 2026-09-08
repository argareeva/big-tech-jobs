---
name: APM title-matching scope
description: What isApmTitle/matchesApmTitle in artifacts/api-server/src/lib/jobs/fetchers.ts do and do not match, and the reasoning/user decisions behind the boundary — check before widening further.
---

# APM title-matching scope

`isApmTitle`/`matchesApmTitle` (artifacts/api-server/src/lib/jobs/fetchers.ts) decide whether a job title counts as an APM/RPM-equivalent full-time opening. Read the current implementation for the exact word lists; this file records the *scope intent* behind them, which isn't obvious from the code alone.

## Current design (as of 2026-09-08) — two layers, superseding the old adjacency rule
1. **Layer 1 (generic, `isApmTitle`)**: the title contains "product" or "program" **anywhere**, AND also contains one of a fixed qualifier-word list (Associate, New Grad, Entry Level, Recent Graduate, University Graduate, Campus, Rotational, Early Career, Junior, Apprentice, Fellow, Academy, Xcelerator, Builder, Graduate Program), anywhere in the title — **no adjacency requirement**. This was an explicit, twice-confirmed user spec that intentionally supersedes the earlier (2026-09-08, same day) adjacency-based rule, which required the qualifier word to sit immediately before "product"/"program".
2. **Layer 2 (per-company, `matchesApmTitle` + `CompanyConfig.titleAliases`)**: a literal, case-insensitive substring list per company, for titles that don't share wording with the generic qualifier list at all (e.g. Jane Street's "Strategy and Product", Figma's "Early Career"). Falls back to Layer 1 when no alias matches.
3. Both layers still exclude internship-flagged titles first (see `isInternshipTitle`).

**Known accepted trade-off:** dropping the adjacency requirement means some now-broader matches are not true APM/PM roles — e.g. "Senior Associate, Product Management" and "Associate Director of Product Marketing" now match, even though they're mid/senior or marketing-adjacent titles, not entry-level PM programs. This was surfaced to the user rather than silently re-narrowed; it has not been rejected, but if false positives cause real complaints, the fix should be a smarter proximity/exclusion rule, not a silent revert of the qualifier-word list itself.

**Why:** the user provided this two-layer scheme as an explicit, formalized spec (after the previous adjacency-based rule kept missing real postings whose qualifier word wasn't immediately next to "product"/"program", e.g. company-specific phrasing entirely outside the pattern). The per-company alias layer exists because some companies' real titles have zero lexical overlap with any generic qualifier word.

**How to apply:** when a user reports another missed posting, first check whether it's a Layer 1 gap (a qualifier word not yet in the list) vs. a Layer 2 gap (a company-specific title with no qualifier word at all — add a `titleAliases` entry for that company instead of touching the generic pattern). Also check whether the fetcher's own search query surfaces the candidate at all (see apm-ats-endpoints.md) — that's a separate failure mode from title matching.
</content>
