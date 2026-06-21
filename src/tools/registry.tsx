import type { ReactNode } from 'react'
import { SignRoute } from '../routes/SignRoute'
import { MergeRoute } from '../routes/MergeRoute'

/**
 * Tool registry — the SINGLE SOURCE OF TRUTH for the FreeESign tool suite (SUITE-03).
 *
 * Every consumer derives from this one array:
 *   - App.tsx generates the route table from `liveTools()` (this plan, 10-01).
 *   - The tools-hub grid + tools-listing view consume the full registry (10-02).
 *
 * Adding a tool = adding one entry here. No other file enumerates the tools.
 *
 * `status`:
 *   - 'live'        → has a non-null `element`; mounted as a real <Route>.
 *   - 'coming-soon' → placeholder card for the hub roadmap; `element` is null,
 *                     no route is mounted for it in the Routes table.
 */
export interface ToolDescriptor {
  /** Stable unique id (also used as the React key for routes/cards). */
  id: string
  /** Display name shown on hub cards and listing rows. */
  name: string
  /** One-line description for hub cards / listing rows. */
  blurb: string
  /** Route path (e.g. '/sign'). Only `live` tools mount a route here. */
  route: string
  /** Lifecycle status — drives whether a route is mounted and how the card renders. */
  status: 'live' | 'coming-soon'
  /** The route element for `live` tools; `null` for `coming-soon` placeholders. */
  element: ReactNode
}

/**
 * The canonical tool list.
 *
 * Sign and Merge are live. Split/Organize/Convert remain coming-soon
 * placeholders so the hub (10-02) renders a complete-looking roadmap; they
 * mount no route until their phase (11-03/11-04 for Split/Organize, P12 for Convert).
 */
export const TOOL_REGISTRY: ToolDescriptor[] = [
  {
    id: 'sign',
    name: 'Sign',
    blurb: 'Sign a PDF in your browser — your document never leaves your device.',
    route: '/sign',
    status: 'live',
    element: <SignRoute />,
  },
  {
    id: 'merge',
    name: 'Merge',
    blurb: 'Combine several PDFs into one — in your browser.',
    route: '/merge',
    status: 'live',
    element: <MergeRoute />,
  },
  {
    id: 'split',
    name: 'Split',
    blurb: 'Pull pages out of a PDF into separate files — coming soon.',
    route: '/split',
    status: 'coming-soon',
    element: null,
  },
  {
    id: 'organize',
    name: 'Organize',
    blurb: 'Reorder, rotate, and remove PDF pages — coming soon.',
    route: '/organize',
    status: 'coming-soon',
    element: null,
  },
  {
    id: 'convert',
    name: 'Convert',
    blurb: 'Convert images and documents to PDF — coming soon.',
    route: '/convert',
    status: 'coming-soon',
    element: null,
  },
]

/**
 * Live tools only — the subset that mount real routes.
 * App.tsx maps this to <Route path={route} element={element} />.
 */
export function liveTools(): ToolDescriptor[] {
  return TOOL_REGISTRY.filter((t) => t.status === 'live')
}
