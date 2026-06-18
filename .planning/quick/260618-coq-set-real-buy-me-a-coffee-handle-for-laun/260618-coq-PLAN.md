---
quick_id: 260618-coq
description: Set real Buy Me a Coffee handle for launch
date: 2026-06-18
status: complete
---

# Quick Task 260618-coq: Set real Buy Me a Coffee handle for launch

## Objective

Replace the `PLACEHOLDER` Buy Me a Coffee URL with the user's real handle
(`clamd24e`) ahead of the v1.0 live launch, and re-enable the guard test that
was intentionally skipped while the placeholder was in place. Carried-forward
human task from the v1.0 milestone (LND-03 / deploy step 7).

## Tasks

1. **Set the real BMC URL** — `src/config.ts`
   - `BUY_ME_A_COFFEE_URL`: `https://www.buymeacoffee.com/PLACEHOLDER` → `https://www.buymeacoffee.com/clamd24e`
   - Keep the `www.` host so the existing `landingPage.test.tsx` href assertion
     (`/^https:\/\/www\.buymeacoffee\.com\//`) stays exact; apex and www resolve
     to the same BMC page.
   - Refresh the now-stale "BEFORE LAUNCH: Replace PLACEHOLDER" doc comment.

2. **Re-enable the placeholder guard test** — `src/test/landingPage.test.tsx`
   - `it.skip('BUY_ME_A_COFFEE_URL does not contain PLACEHOLDER ...')` → `it(...)`
   - Update the TODO comment to reflect the handle is now set; the guard stays
     active to catch any accidental regression to a placeholder.

3. **Verify** — `npx vitest run` (all tests green, including the un-skipped guard).

## Constraints

- Do NOT add analytics or modify `vercel.json` — the zero-third-party-request
  guarantee (PRV-03) and its `privacyGuard.test.ts` assertions must stay intact.
- Plain `<a href>` only — no BMC script/widget (LND-03).
