# FreeESign — Design

The visual design for FreeESign, explored as interactive HTML mockups before implementation.
Each sketch is a **self-contained HTML file** — no build step, no external requests (in keeping with
the app's zero-third-party-request privacy promise). Open any `index.html` in a browser and use the
dark bar at the top to switch screens, accents, or intensity levels.

## Direction: "Instrument panel"

Teenage Engineering–influenced. The app is presented as a calm, deliberate **instrument**: you load a
document, operate on it, and output it untouched. Minimal but *intentional* — the opposite of a generic
default-framework look.

## Key decisions

- **Palette:** warm bone / aluminum neutrals (`#E4DFD3` / `#F5F2EA` / paper `#FCFBF7`, ink `#1A1714`) —
  never cold grey. **Accent: Signal Orange `#FF4D00`** (a "Fountain-Pen Ink" `#13293D` alternative is
  included — flip the accent toggle in any sketch to compare).
- **Typography:** monospace for all chrome, labels, and numbers; `system-ui` for headings/body; a script
  face for typed signatures.
- **Wordmark:** `free·esign` — lowercase, an accent-colored middot, and a small engraved square mark.
- **Layout:** the editor is an aluminum **console** (chassis, screws, glowing LCD readout, hardware
  keypad, zoom knob, indicator LEDs); the landing hero is a **full handheld "unit"** product shot. The
  document floats on a dotted-grid worktable with registration marks.
- **Controls:** hardware "keys" with press physics, and a calm, functional zoom **knob** whose tick ring
  is bounded to its actual 270° travel.

## The sketches

| # | Sketch | What it explores |
|---|--------|------------------|
| 001 | [`instrument-panel`](./001-instrument-panel/index.html) | The whole direction across landing / load / editor; accent A/B (orange vs ink) |
| 002 | [`hardware-chassis`](./002-hardware-chassis/index.html) | How much hardware the editor wears — minimal → console → full unit |
| 003 | [`zoom-control`](./003-zoom-control/index.html) | Which zoom control reads as operable — stepper / fader / knob (all live) |
| 004 | [`knob-refine`](./004-knob-refine/index.html) | Refining the knob: clean silhouette, functional, ticks bounded to travel |

Shared theme tokens live in [`themes/`](./themes/) (`default.css` = Signal Orange, `ink.css` = the ink alt).

## Status

These are **design explorations**, not the shipped UI. The live app currently uses a simpler interim
design; this instrument direction is the target for an upcoming UI pass.
