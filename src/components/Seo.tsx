import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SITE_URL } from '../config'

/**
 * Seo.tsx — per-route document-head manager (dependency-free, React-19-safe).
 *
 * FreeESign is a client-rendered SPA: every route is rewritten to the same
 * index.html by the Vercel SPA fallback, so the static <head> in index.html can
 * only carry ONE title/description (the homepage defaults). This module gives
 * each route its OWN <title>, <meta name="description">, <link rel="canonical">,
 * and og:/twitter: title+description so a JS-executing crawler (Google) indexes
 * each tool page distinctly under its target keywords.
 *
 * It updates the head IMPERATIVELY in a useEffect (the classic pre-helmet
 * pattern) rather than rendering <title>/<meta> elements. Two reasons:
 *   1. It mutates the tags already shipped in index.html in place, so there is
 *      never a duplicate <title> (React-19 head-hoisting would append a second
 *      one, and document.title resolves to the FIRST title element).
 *   2. Canonical/og URLs are built from SITE_URL and set via the DOM — never as a
 *      static canonical link element with an absolute https href in source — so
 *      the PRV-03 privacy guard (which forbids external asset-loading link/script
 *      tags) stays green. Absolute social URLs live only in meta content
 *      attributes, which the guard does not match.
 *
 * Non-JS social scrapers (Twitter/Facebook) read the static index.html tags and
 * see the homepage card for every route — acceptable without SSR/prerendering.
 */

interface RouteMeta {
  title: string
  description: string
}

/** Homepage defaults — also the fallback for any unrecognised path. */
const HOME: RouteMeta = {
  title: 'FreeESign — Free, private PDF tools (sign, merge, split, convert)',
  description:
    'Sign, merge, split, organize, and convert PDFs free in your browser. No uploads, no sign-up, no watermarks — your files never leave your device.',
}

/**
 * Per-route SEO copy, keyword-targeted to high-intent searches ("merge pdf
 * free", "sign a pdf online free", "pdf to jpg") while staying honest to the
 * product (free, private, no upload). Keyed by exact pathname.
 */
export const ROUTE_SEO: Record<string, RouteMeta> = {
  '/': HOME,
  '/tools': {
    title: 'All free PDF tools — sign, merge, split, organize, convert | FreeESign',
    description:
      'Every FreeESign tool in one place: sign, merge, split, organize, and convert PDFs free in your browser. No uploads, no account, no watermarks.',
  },
  '/sign': {
    title: 'Sign a PDF free online — no upload, no account | FreeESign',
    description:
      'Add your signature to a PDF free in your browser. Draw or type your signature, place it anywhere, and download — your document never leaves your device.',
  },
  '/merge': {
    title: 'Merge PDF free — combine PDF files in your browser | FreeESign',
    description:
      'Combine multiple PDFs into one, free and private. No uploads, no sign-up, no watermarks — merging runs entirely in your browser.',
  },
  '/split': {
    title: 'Split PDF free — extract pages in your browser | FreeESign',
    description:
      'Split a PDF or pull individual pages into their own files, free and private. No uploads, no account — everything runs in your browser.',
  },
  '/organize': {
    title: 'Organize PDF free — reorder, rotate & delete pages | FreeESign',
    description:
      'Reorder, rotate, and remove PDF pages, then rebuild your file — free, private, and in your browser. No uploads.',
  },
  '/pdf-to-image': {
    title: 'PDF to image free — convert PDF to JPG or PNG | FreeESign',
    description:
      'Convert each PDF page to a JPG or PNG image, free and private. No uploads — conversion runs in your browser.',
  },
  '/image-to-pdf': {
    title: 'Image to PDF free — combine JPG & PNG into a PDF | FreeESign',
    description:
      'Combine JPG or PNG images into a single PDF, free and private. No uploads, no watermarks — runs in your browser.',
  },
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export interface SeoProps extends RouteMeta {
  /** Canonical path beginning with '/'. Use '/' for the homepage. */
  path: string
}

/** Imperatively syncs the document head for the active route. Renders nothing. */
export function Seo({ title, description, path }: SeoProps) {
  useEffect(() => {
    const url = `${SITE_URL}${path === '/' ? '/' : path}`
    document.title = title
    upsertMeta('name', 'description', description)
    upsertCanonical(url)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
  }, [title, description, path])

  return null
}

/**
 * RouteSeo — route-aware wrapper. Reads the active pathname and applies the
 * matching ROUTE_SEO entry (falling back to the homepage copy + canonical for
 * any unknown path, which the router's catch-all redirects to '/'). Mounted once
 * inside <BrowserRouter> in App.tsx.
 */
export function RouteSeo() {
  const { pathname } = useLocation()
  const known = ROUTE_SEO[pathname]
  const meta = known ?? HOME
  return <Seo title={meta.title} description={meta.description} path={known ? pathname : '/'} />
}
