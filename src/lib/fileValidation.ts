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

export type FileValidationError = 'unsupported-type' | 'too-large' | null

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

  // 2. MIME type check (T-01-06 — primary signal from browser)
  if (!ALLOWED_MIMES.has(file.type)) {
    return 'unsupported-type'
  }

  // 3. Extension check — defense in depth (T-01-06)
  // Extract the extension from the filename; toLowerCase for case-insensitivity.
  const lastDot = file.name.lastIndexOf('.')
  const extension = lastDot >= 0 ? file.name.slice(lastDot).toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return 'unsupported-type'
  }

  return null
}
