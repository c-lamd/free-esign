/**
 * toolDownload.ts
 *
 * Shared output layer for every Phase 11 tool (Merge / Split / Organize). It owns
 * two responsibilities, both fully client-side (PAR-05 / PAR-07):
 *
 *   1. zipFiles — bundle multiple named byte blobs into one .zip entirely in-memory
 *      via fflate's synchronous zipSync (no worker, no CDN, no network; fflate is
 *      bundled with the app, so there is no external request).
 *
 *   2. triggerBlobDownload — the SINGLE download call-site shape each tool funnels
 *      through (one per successful download). It mirrors exportPdf.ts's triggerDownload
 *      anchor pattern but parameterizes the mime type ('application/pdf' for single-PDF
 *      tools, 'application/zip' for split-each). This is intentionally the one place a
 *      tool emits a file, so Phase 13 (deferred) can wrap exactly one counter increment
 *      per successful download without touching any tool internals.
 *
 * This file deliberately does NOT import exportPdf.ts (keeps the signing path
 * untouched) and does NOT increment any counter (that is Phase 13 — out of scope).
 */

import { zipSync } from 'fflate'
import { recordExport } from './counter'

/** One entry to place inside a zip: a filename and its raw bytes. */
export interface ZipEntry {
  name: string
  bytes: Uint8Array
}

/**
 * Bundles the given entries into a single .zip byte array, synchronously and entirely
 * in-memory via fflate. Round-trips through fflate's unzipSync to the exact same
 * named entries + bytes.
 *
 * @param entries - Files to zip (name + bytes); must be non-empty.
 * @returns The .zip bytes as a Uint8Array.
 * @throws Tagged Error if `entries` is empty (nothing to zip).
 */
export function zipFiles(entries: ZipEntry[]): Uint8Array {
  if (entries.length === 0) {
    throw new Error('Could not create the zip: there is nothing to zip.')
  }
  const record: Record<string, Uint8Array> = {}
  for (const { name, bytes } of entries) record[name] = bytes
  return zipSync(record)
}

/**
 * Triggers a browser file download of `bytes` as `filename` with the given mime type.
 *
 * Mirrors exportPdf.ts's triggerDownload shape EXACTLY (Blob → createObjectURL →
 * anchor with download attr → appendChild → click → removeChild → setTimeout revoke),
 * but parameterizes the mime so the same call-site serves single-PDF and zip outputs.
 *
 * This is the ONE download call-site every Phase 11 tool reuses — keep it
 * side-effect-only and dependency-light so Phase 13 can hook a single counter
 * increment here per successful download.
 *
 * @param bytes - The file bytes to download.
 * @param filename - The download filename (e.g. 'merged.pdf' or 'report-pages.zip').
 * @param mime - The blob mime type ('application/pdf' or 'application/zip').
 */
export function triggerBlobDownload(bytes: Uint8Array, filename: string, mime: string): void {
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a brief delay so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 100)
  // CNT-03: exactly one counter increment per successful export. Every Phase 11
  // tool (merge / split — both range and each-page-zip branches / organize /
  // pdf-to-image — single image AND multi-image-zip / image-to-pdf) funnels one
  // export action through this single call-site, so this is the one increment.
  // Fire-and-forget; never throws or blocks the download (CNT-04).
  recordExport()
}
