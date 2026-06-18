---
quick_id: 260618-coq
description: Set real Buy Me a Coffee handle for launch
date: 2026-06-18
status: complete
---

# Quick Task 260618-coq Summary

## What changed

- **`src/config.ts`** — `BUY_ME_A_COFFEE_URL` set to `https://www.buymeacoffee.com/clamd24e`
  (was `.../PLACEHOLDER`). Doc comment refreshed to note the handle is set for
  launch and to record why the `www.` host is used (test-assertion exactness;
  apex and www resolve to the same page).
- **`src/test/landingPage.test.tsx`** — re-enabled the placeholder guard
  (`it.skip` → `it`). It now actively asserts the URL contains no `PLACEHOLDER`,
  catching future regressions. TODO comment updated.

## Verification

- `npx vitest run` → **546 passed (14 files)**, up from 545 active (the
  previously-skipped guard now runs and passes).
- The BMC link remains a plain navigation `<a href>` — no script/widget loaded;
  `privacyGuard.test.ts` (PRV-03) untouched and still green.
- `vercel.json` not modified — no `analytics` / `speedInsights` keys (privacy guard intact).

## Notes

- This clears the LND-03 carried-forward human task ("set the real Buy Me a
  Coffee handle"). Remaining v1.0 post-launch human tasks (live DevTools
  zero-third-party network audit, and confirming the BMC link opens the real
  page in a browser) are runtime checks the user performs against the deployed site.
