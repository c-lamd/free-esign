/**
 * organizeTool.test.tsx — Organize pages tool tests (Phase 11, plan 11-04).
 *
 * Covers, across three tasks:
 *   - Task 1: PageThumbnail — renders a pdfjs page preview (mocked), shows a
 *             1-based page-number badge, passes its rotation through to the (mocked)
 *             Page rotate prop, and fires onRotate / onDelete from its controls.
 *   - Task 2: OrganizeRoute — upload → single <Document> thumbnail grid; reorder /
 *             delete / rotate edit the page model; REBUILD calls organizePages(file, ops)
 *             then triggerBlobDownload('<base>-organized.pdf') exactly once; a rejection
 *             surfaces an inline error and does NOT download; empty grid disables REBUILD;
 *             and a fetch-spy asserts ZERO network across the rebuild flow (PAR-05).
 *   - Task 3: registry — organize flipped coming-soon → live with a non-null element,
 *             liveTools() now contains it, and the blurb drops "coming soon".
 *
 * pdfjs-in-jsdom note: react-pdf touches DOMMatrix/worker at import time, which jsdom
 * lacks. We mock 'react-pdf' and '../lib/pdfWorker' EXACTLY as registry.test.tsx /
 * splitTool.test.tsx do, so PageThumbnail / OrganizeRoute import cleanly. Tests assert
 * BEHAVIOR (controls fire callbacks, rotation/order state, rebuild wiring), never pixels.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Mock react-pdf so <Document>/<Page> import cleanly and we can inspect props ──
// The mocked <Page> renders a marker carrying its pageNumber + rotate so tests can
// assert the rotation value flows through without any real pdfjs rendering.
vi.mock('react-pdf', () => ({
  Document: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="pdf-document">{children}</div>
  ),
  Page: ({ pageNumber, rotate }: { pageNumber: number; rotate?: number }) => (
    <div data-testid="pdf-page" data-page-number={pageNumber} data-rotate={rotate ?? 0} />
  ),
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' }, version: '0' },
}))
vi.mock('../lib/pdfWorker', () => ({
  default: undefined,
  pdfOptions: { cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' },
}))

// ── Mock the foundation libs (11-01) so the rebuild wiring is asserted in isolation ──
const mockOrganizePages = vi.fn()
const mockGetPageCount = vi.fn((..._args: unknown[]) => Promise.resolve(3))
const mockTriggerBlobDownload = vi.fn()

vi.mock('../lib/pdfOrganize', () => ({
  organizePages: (...args: unknown[]) => mockOrganizePages(...args),
  getPageCount: (...args: unknown[]) => mockGetPageCount(...args),
}))
vi.mock('../lib/toolDownload', () => ({
  triggerBlobDownload: (...args: unknown[]) => mockTriggerBlobDownload(...args),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a valid PDF File (application/pdf + .pdf) with small dummy bytes. */
function makePdf(name: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'application/pdf' })
}

/** Fire a change on a file input with the given Files (jsdom can't assign .files directly). */
function selectFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  fireEvent.change(input)
}

/** Find a button whose aria-label matches the given regex. */
function getButton(container: Element, re: RegExp): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    re.test(b.getAttribute('aria-label') ?? ''),
  )
  if (!btn) throw new Error(`button matching ${re} not found`)
  return btn as HTMLButtonElement
}

/** All buttons whose aria-label matches the given regex, in DOM order. */
function getButtons(container: Element, re: RegExp): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button')).filter((b) =>
    re.test(b.getAttribute('aria-label') ?? ''),
  ) as HTMLButtonElement[]
}

// ───────────────────────────────────────────────────────────────────────────
// Task 1: PageThumbnail
// ───────────────────────────────────────────────────────────────────────────

describe('PageThumbnail — pdfjs page preview + controls', () => {
  it('shows the 1-based displayNumber badge', async () => {
    const { PageThumbnail } = await import('../components/PageThumbnail')
    const { container } = render(
      <PageThumbnail
        srcIndex={0}
        displayNumber={1}
        rotation={0}
        onRotate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(container.textContent ?? '').toMatch(/\b1\b/)
  })

  it('passes its rotation through to the (mocked) Page rotate prop', async () => {
    const { PageThumbnail } = await import('../components/PageThumbnail')
    const { container } = render(
      <PageThumbnail
        srcIndex={2}
        displayNumber={3}
        rotation={90}
        onRotate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    const page = container.querySelector('[data-testid="pdf-page"]') as HTMLElement
    expect(page).not.toBeNull()
    expect(page.getAttribute('data-rotate')).toBe('90')
    // srcIndex 2 → pageNumber 3 (1-based)
    expect(page.getAttribute('data-page-number')).toBe('3')
  })

  it('fires onRotate when the rotate control is clicked', async () => {
    const { PageThumbnail } = await import('../components/PageThumbnail')
    const onRotate = vi.fn()
    const { container } = render(
      <PageThumbnail
        srcIndex={0}
        displayNumber={1}
        rotation={0}
        onRotate={onRotate}
        onDelete={vi.fn()}
      />,
    )
    fireEvent.click(getButton(container, /rotate/i))
    expect(onRotate).toHaveBeenCalledTimes(1)
  })

  it('fires onDelete when the delete control is clicked', async () => {
    const { PageThumbnail } = await import('../components/PageThumbnail')
    const onDelete = vi.fn()
    const { container } = render(
      <PageThumbnail
        srcIndex={0}
        displayNumber={1}
        rotation={0}
        onRotate={vi.fn()}
        onDelete={onDelete}
      />,
    )
    fireEvent.click(getButton(container, /delete|remove/i))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Task 2: OrganizeRoute — grid, reorder/delete/rotate, rebuild/download
// ───────────────────────────────────────────────────────────────────────────

/** Renders OrganizeRoute inside a router, returns RTL utils. */
async function renderOrganizeRoute() {
  const { OrganizeRoute } = await import('../routes/OrganizeRoute')
  return render(
    <MemoryRouter>
      <OrganizeRoute />
    </MemoryRouter>,
  )
}

/**
 * Upload a PDF and drive the route to a 3-page grid. The route reads its page count
 * from the (mocked) Document onLoadSuccess; since Document is mocked, we trigger the
 * grid by simulating a known page count. The route exposes onLoadSuccess via the
 * mocked Document is a no-op, so OrganizeRoute MUST derive numPages from getPageCount
 * on upload — we mock organizePages-adjacent page count below.
 */
async function uploadAndGrid(container: Element, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  await act(async () => {
    selectFiles(input, [file])
  })
}

describe('OrganizeRoute — upload renders a thumbnail grid', () => {
  it('shows one thumbnail per page after upload (single shared Document)', async () => {
    const { container } = await renderOrganizeRoute()
    await uploadAndGrid(container, makePdf('report.pdf'))
    // exactly one <Document> (single parse), N <Page> thumbnails
    expect(container.querySelectorAll('[data-testid="pdf-document"]').length).toBe(1)
    const pages = container.querySelectorAll('[data-testid="pdf-page"]')
    expect(pages.length).toBe(3)
  })
})

describe('OrganizeRoute — rebuild wiring', () => {
  it('REBUILD calls organizePages(file, ops) then triggerBlobDownload once', async () => {
    const OUT = new Uint8Array([0x25, 0x50, 0x44, 0x46])
    mockOrganizePages.mockResolvedValue(OUT)

    const { container } = await renderOrganizeRoute()
    await uploadAndGrid(container, makePdf('report.pdf'))

    await act(async () => {
      fireEvent.click(getButton(container, /rebuild/i))
    })

    expect(mockOrganizePages).toHaveBeenCalledTimes(1)
    const ops = mockOrganizePages.mock.calls[0][1] as { srcIndex: number; rotate: number }[]
    // default order: 0,1,2 with no rotation
    expect(ops.map((o) => o.srcIndex)).toEqual([0, 1, 2])
    expect(ops.every((o) => o.rotate === 0)).toBe(true)

    expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1)
    const [bytes, filename, mime] = mockTriggerBlobDownload.mock.calls[0]
    expect(bytes).toBe(OUT)
    expect(filename).toMatch(/report-organized\.pdf$/)
    expect(mime).toBe('application/pdf')
  })

  it('rotate advances a page rotation and is reflected in ops.rotate', async () => {
    mockOrganizePages.mockResolvedValue(new Uint8Array([1]))
    const { container } = await renderOrganizeRoute()
    await uploadAndGrid(container, makePdf('report.pdf'))

    // rotate the first page once → 90
    act(() => {
      fireEvent.click(getButtons(container, /rotate/i)[0])
    })
    await act(async () => {
      fireEvent.click(getButton(container, /rebuild/i))
    })

    const ops = mockOrganizePages.mock.calls[0][1] as { srcIndex: number; rotate: number }[]
    expect(ops[0]).toEqual({ srcIndex: 0, rotate: 90 })
  })

  it('delete removes a page from ops; deleting all disables REBUILD', async () => {
    mockOrganizePages.mockResolvedValue(new Uint8Array([1]))
    const { container } = await renderOrganizeRoute()
    await uploadAndGrid(container, makePdf('report.pdf'))

    // delete the first page → ops should be [1, 2]
    act(() => {
      fireEvent.click(getButtons(container, /delete|remove/i)[0])
    })
    await act(async () => {
      fireEvent.click(getButton(container, /rebuild/i))
    })
    const ops = mockOrganizePages.mock.calls[0][1] as { srcIndex: number }[]
    expect(ops.map((o) => o.srcIndex)).toEqual([1, 2])

    // now delete the remaining two → REBUILD disabled, no further organizePages call
    mockOrganizePages.mockClear()
    act(() => {
      getButtons(container, /delete|remove/i).forEach((b) => fireEvent.click(b))
    })
    const rebuild = getButton(container, /rebuild/i)
    expect(rebuild.getAttribute('aria-disabled')).toBe('true')
    await act(async () => {
      fireEvent.click(rebuild)
    })
    expect(mockOrganizePages).not.toHaveBeenCalled()
  })

  it('reorder (move down) changes ops srcIndex order', async () => {
    mockOrganizePages.mockResolvedValue(new Uint8Array([1]))
    const { container } = await renderOrganizeRoute()
    await uploadAndGrid(container, makePdf('report.pdf'))

    // move the first page down once → order becomes [1, 0, 2]
    act(() => {
      fireEvent.click(getButtons(container, /move .* down/i)[0])
    })
    await act(async () => {
      fireEvent.click(getButton(container, /rebuild/i))
    })
    const ops = mockOrganizePages.mock.calls[0][1] as { srcIndex: number }[]
    expect(ops.map((o) => o.srcIndex)).toEqual([1, 0, 2])
  })

  it('a rebuild rejection surfaces an inline error and does NOT download', async () => {
    mockOrganizePages.mockRejectedValue(new Error('Could not organize the pages: boom'))
    const { container, queryByRole } = await renderOrganizeRoute()
    await uploadAndGrid(container, makePdf('report.pdf'))

    await act(async () => {
      fireEvent.click(getButton(container, /rebuild/i))
    })

    expect(mockTriggerBlobDownload).not.toHaveBeenCalled()
    const alert = queryByRole('alert')
    expect(alert).not.toBeNull()
    expect(alert?.textContent ?? '').toMatch(/rebuild|corrupt/i)
  })
})

describe('OrganizeRoute — PAR-05 zero network', () => {
  it('the rebuild flow makes no network request', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network blocked in test')))
    const origFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    try {
      mockOrganizePages.mockResolvedValue(new Uint8Array([1]))
      const { container } = await renderOrganizeRoute()
      await uploadAndGrid(container, makePdf('a.pdf'))
      act(() => {
        fireEvent.click(getButtons(container, /rotate/i)[0])
      })
      await act(async () => {
        fireEvent.click(getButton(container, /rebuild/i))
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = origFetch
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Task 3: registry — organize flipped coming-soon → live
// ───────────────────────────────────────────────────────────────────────────

describe('ORG-01: organize registry entry is live', () => {
  it('TOOL_REGISTRY organize is live with a non-null element and no "coming soon" blurb', async () => {
    const { TOOL_REGISTRY } = await import('../tools/registry')
    const organize = TOOL_REGISTRY.find((t) => t.id === 'organize')
    expect(organize).toBeDefined()
    expect(organize?.route).toBe('/organize')
    expect(organize?.status).toBe('live')
    expect(organize?.element).not.toBeNull()
    expect(organize?.blurb ?? '').not.toMatch(/coming soon/i)
  })

  it('liveTools() now contains organize', async () => {
    const { liveTools } = await import('../tools/registry')
    expect(liveTools().some((t) => t.id === 'organize')).toBe(true)
  })
})
