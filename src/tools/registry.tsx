import type { ReactNode } from 'react'
import { SignRoute } from '../routes/SignRoute'
import { MergeRoute } from '../routes/MergeRoute'
import { SplitRoute } from '../routes/SplitRoute'
import { OrganizeRoute } from '../routes/OrganizeRoute'
import { PdfToImageRoute } from '../routes/PdfToImageRoute'
import { ImageToPdfRoute } from '../routes/ImageToPdfRoute'

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
 * Sign, Merge, Split, Organize, PDF → Image, and Image → PDF are all live. The
 * Convert area has TWO tools (Phase 12): pdf-to-image landed in 12-01, resolving the
 * registry's last coming-soon placeholder; image-to-pdf lands here (12-02) as the
 * second live convert tool. EVERY tool in the suite is now live — there are NO
 * coming-soon entries left.
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
    blurb: 'Pull pages out of a PDF or split each page into its own file.',
    route: '/split',
    status: 'live',
    element: <SplitRoute />,
  },
  {
    id: 'organize',
    name: 'Organize',
    blurb: 'Reorder, rotate, and remove PDF pages, then rebuild — in your browser.',
    route: '/organize',
    status: 'live',
    element: <OrganizeRoute />,
  },
  {
    id: 'pdf-to-image',
    name: 'PDF → Image',
    blurb: 'Turn each PDF page into a JPG or PNG — in your browser.',
    route: '/pdf-to-image',
    status: 'live',
    element: <PdfToImageRoute />,
  },
  {
    id: 'image-to-pdf',
    name: 'Image → PDF',
    blurb: 'Combine JPG or PNG images into one PDF — in your browser.',
    route: '/image-to-pdf',
    status: 'live',
    element: <ImageToPdfRoute />,
  },
  // Every tool is live — no coming-soon entries remain.
]

/**
 * Live tools only — the subset that mount real routes.
 * App.tsx maps this to <Route path={route} element={element} />.
 */
export function liveTools(): ToolDescriptor[] {
  return TOOL_REGISTRY.filter((t) => t.status === 'live')
}
