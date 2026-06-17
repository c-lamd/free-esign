/**
 * fileValidation.ts
 *
 * Pure file type + size validation for the FreeESign ingestion pipeline.
 * No DOM dependencies — safe to unit-test in Node/jsdom without browser setup.
 *
 * Security: implements ASVS L1 V5 input validation (MIME + extension whitelist)
 * and V11 business logic (100 MB size cap before any byte read — DoS mitigation).
 * See threat model entries T-01-05 (DoS) and T-01-06 (spoofed file type).
 */

export type FileValidationError = 'unsupported-type' | 'too-large' | 'word-doc' | null

/** 100 MB in bytes — checked BEFORE calling file.arrayBuffer() */
const MAX_FILE_SIZE = 100 * 1024 * 1024

/** Allowed MIME types (defense-in-depth: must match allowed extension too) */
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
])

/** Allowed file extensions (lowercase, including the leading dot) */
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png'])

/**
 * Word-document MIME types (defense-in-depth: checked alongside extension).
 * See threat model T-03-05 and RESEARCH Section 8.
 */
const WORD_MIMES = new Set([
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
])

/**
 * Word-document extensions (lowercase, with leading dot).
 * Used as fallback when the browser reports application/zip for .docx files.
 */
const WORD_EXTENSIONS = new Set(['.doc', '.docx'])

/**
 * Validate a File for type (MIME + extension whitelist) and size cap.
 *
 * Returns:
 *   - null           — file is acceptable
 *   - 'too-large'    — size > 100 MB (checked before any byte read)
 *   - 'unsupported-type' — MIME or extension not in whitelist
 */
export function validateFile(file: File): FileValidationError {
  // 1. Size check FIRST — never read bytes if over the limit (T-01-05)
  if (file.size > MAX_FILE_SIZE) {
    return 'too-large'
  }

  // 2. Word-doc check BEFORE generic unsupported-type (T-03-05, DOC-05)
  // Extract extension early so both MIME and extension checks can use it.
  // Defense-in-depth: either MIME or extension triggers the 'word-doc' result.
  // This covers the browser quirk where .docx is reported as application/zip.
  const lastDot = file.name.lastIndexOf('.')
  const ext = lastDot >= 0 ? file.name.slice(lastDot).toLowerCase() : ''
  if (WORD_MIMES.has(file.type) || WORD_EXTENSIONS.has(ext)) {
    return 'word-doc'
  }

  // 3. MIME type check (T-01-06 — primary signal from browser)
  if (!ALLOWED_MIMES.has(file.type)) {
    return 'unsupported-type'
  }

  // 4. Extension check — defense in depth (T-01-06)
  // Reuse the extension already extracted above.
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return 'unsupported-type'
  }

  return null
}
