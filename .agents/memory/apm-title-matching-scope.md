---
name: APM title-matching scope
description: What isApmTitle in artifacts/api-server/src/lib/jobs/fetchers.ts does and does not match, and the reasoning/user decisions behind the boundary — check before widening further.
---

# APM title-matching scope

`isApmTitle` (artifacts/api-server/src/lib/jobs/fetchers.ts) decides whether a job title counts as an APM/RPM-equivalent full-time opening. It has been widened twice, both times in response to a real posting the user found that was missing from the tracker — not proactively. Read the current implementation for the exact regexes; this file records the *scope intent* behind them, which isn't obvious from the code alone.

## Current matching intent (as of 2026-09-08)
1. Exact "associate/rotational product manager" / "associate/rotational program manager" phrasing.
2. "Associate"/"Rotational" immediately followed by any product/program word (not just "Manager") — e.g. "Associate Product Specialist". Requires immediate adjacency; a comma in between (e.g. "Senior Associate, Product Management") does **not** match, because that's a mid/senior corporate title pattern, not an entry-level program.
3. Titles explicitly labeled "New Grad" combined with product/program context, even without "Associate"/"Rotational" — e.g. "Product Manager, New Grad". "New Grad" is treated as its own unambiguous entry-level signal.
4. PayPal's "graduate business leadership" (GBLP) phrase, and bare "APM"/"RPM" acronyms when combined with "product" or "program" context.

**Why:** the user explicitly rejected matching on any title merely containing "Associate", "Product", or "Manager" individually — that would flood the tracker with irrelevant senior/unrelated roles (e.g. "Senior Manager, Payroll", "Director of Product", "Associate General Counsel"). The rule needs to keep firmly to entry-level/rotational-program framing while still catching title variants beyond a strict "Product/Program Manager" template.

**How to apply:** when a user reports another missed posting with a new title pattern, don't assume it's just a search-query problem (see Mastercard/Disney entries in apm-ats-endpoints.md, where the *search query itself* also needed broadening, separately from the title filter) — check both (a) whether the fetcher's search query even returns the candidate in its result page, and (b) whether isApmTitle's regex covers the exact phrasing, and confirm live before shipping a fix. If a proposed widening would match on a bare keyword alone, ask the user first — that failure mode has already been explicitly rejected once.
