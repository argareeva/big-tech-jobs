---
name: Company posting history
description: The Companies grid uses persisted per-company feed history to distinguish never-posted companies from companies whose tracked postings have closed.
---

The company history signal is intentionally insert-only and begins tracking from the first successful refresh after the feature ships. It does not reconstruct jobs that disappeared before tracking began, and a fetch error must not be treated as proof that a posting closed.

**Why:** Current job counts are transient and cannot distinguish a company that has never posted from one whose last posting closed; historical job-level storage would add unnecessary scope.

**How to apply:** Preserve the insert-only signal and the successful-fetch requirement when changing company grouping, feed refreshes, or closed-state messaging.