---
name: Monorepo generated artifacts
description: Generated package outputs can become stale and misrepresent current source types during cross-package checks.
---

In this pnpm monorepo, generated declarations from a shared package may outlive the source schema and produce misleading downstream type errors. Rebuild the referenced shared package before diagnosing a consumer error as a real schema mismatch.

**Why:** The auth integration check surfaced an apparent database-table shape error that disappeared after the shared package declarations were regenerated; the source files were already correct.

**How to apply:** When a consumer package reports a type shape that contradicts the current shared source, force-rebuild the referenced package and rerun the consumer check before editing application logic.