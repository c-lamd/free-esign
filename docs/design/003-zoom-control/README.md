---
sketch: 003
name: zoom-control
question: "Which zoom control reads as operable in the L2 console — stepper, fader, or knob?"
winner: "C · Knob (control type) — styling refined in 004"
tags: [editor, control, affordance, zoom]
locked: [accent=orange, wordmark=free·esign, level=L2-console]
---

# Sketch 003: Zoom Control

Resolves the open issue from 002: the rotary knob looked good but didn't read as functional (and
wasn't wired). This isolates the zoom control and makes **all three candidates fully functional** —
they share one zoom state, so operating any control actually scales the document and moves the others.
That kills the "is it even functional?" doubt and reduces the decision to pure form.

## Design Question
Which control does a first-time user operate without thinking?

## How to View
```
open .planning/sketches/003-zoom-control/index.html
```
Click the **A** steppers · drag the **B** fader cap · drag the **C** knob up/down. Watch the live
viewport scale.

## Candidates
- **A — Stepper** ⭐ *(recommended)* — `[ − ] [ 100% ] [ + ]` hardware keys with an inset LCD value.
  Zero ambiguity, very Pocket-Operator, works on touch and keyboard. The safe, obvious choice.
- **B — Fader** — a hardware slider with a draggable cap and accent fill. Tactile, very OP-1, clear
  drag affordance. A good middle ground if you want something more physical than buttons.
- **C — Knob (rebuilt)** — now genuinely draggable (↕), with the fixes you asked for: a stronger drop
  shadow, an **accent progress arc** that sweeps with the value (the "indicative indicator"), a value
  readout, and a `▲▼ DRAG` hint. Still the weakest affordance of the three on a screen, but no longer
  dead or mysterious.

## What to Look For
- Which one would your mum operate correctly on the first try? (That's the real test for a free tool.)
- Does the knob's arc + shadow now make it feel operable — enough to justify keeping it for looks?
- In the L2 console, a stepper also pairs cleanly with the `◀PG / PG▶` utility keys (consistent grammar).

## Recommendation (to confirm or overrule)
**A — Stepper** for the shipping editor. It's the one nobody has to learn. Keep the knob in the
back pocket as a "pro" flourish if you ever want it, but the default should be unmissable.
