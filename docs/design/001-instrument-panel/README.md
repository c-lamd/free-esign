---
sketch: 001
name: instrument-panel
question: "Does the Teenage-Engineering 'instrument' direction hold up across the three core screens, and which accent reads best — Signal Orange or Fountain-Pen Ink?"
winner: null
tags: [landing, upload, editor, branding, palette]
---

# Sketch 001: Instrument Panel

## Design Question
Two things at once:
1. Does the **instrument-panel** aesthetic (warm bone neutrals, monospace chrome, hardware keys,
   dotted-grid worktable) make FreeESign feel *designed-on-purpose* instead of default-Tailwind —
   without sacrificing the trust a document tool needs?
2. Which **accent** wins on sight: **Signal Orange** (`#FF4D00`, energetic/friendly) or
   **Fountain-Pen Ink** (`#13293D`, serious/legal)?

## How to View
```
open .planning/sketches/001-instrument-panel/index.html
```
Use the dark **sketch bar** at the very top:
- **Screen tabs** — `01 LANDING` · `02 LOAD` · `03 EDITOR` — walk the whole flow
- **ACCENT toggle** — flip `ORANGE ↔ INK` live and watch everything recolor

The big buttons inside the mockup are wired too: **START SIGNING** / **BROWSE** advance the flow,
the field **keys** (SIG/INI/DATE/TXT/☑) arm with a press, and **EXPORT** fires a toast.

## Screens
These are not competing variants — they're **one system shown across three surfaces**:
- **01 Landing** — restyled `free·esign` wordmark, the honest founder copy, a hardware
  `▶ START SIGNING` key, a mini "unit" preview of the editor, and a small wordmark study
  (`free·esign` vs `FREE eSIGN`).
- **02 Load** — the empty state reframed as an *insert document* slot: dashed drop bay, mono
  status line (`FILE — none · NET — 0 requests`), and the privacy promise.
- **03 Editor** — the control-panel top bar (`FILE — contract.pdf` · field keys · `↧ EXPORT`),
  a status strip (`PG 1/3 · ZOOM 100% · FIELDS 2 · ORIGINAL BYTES PRESERVED`), and the document
  floating on the dotted-grid worktable with two placed fields (signature + date), corner handles,
  mono field tags, and registration marks.

## What to Look For
- Does the mono-label "hardware" chrome feel **intentional and calm**, or busy?
- **Orange vs Ink** — which would you trust with a contract? Which feels more *you*?
- The `free·esign` wordmark vs the `FREE eSIGN` study — which lockup?
- Field keys + placed-field treatment — does "an instrument operating on a document" land?
- The "ORIGINAL BYTES PRESERVED" status — surfacing the core privacy guarantee as a *readout*.

## Theme files
- `../themes/default.css` — Signal Orange (loaded by default)
- `../themes/ink.css` — Fountain-Pen Ink
Both share the warm bone/aluminum base; only the accent block differs.
