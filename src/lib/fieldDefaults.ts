/**
 * fieldDefaults.ts
 *
 * Shared constants for form field rendering and PDF export.
 * Centralising these ensures the on-screen size (PlacedFieldWidget) and
 * the exported PDF size (exportPdf drawTextInBox) stay in sync — WYSIWYG.
 */

/** Font size (in PDF points) for text/date form fields — both UI preview and PDF export. */
export const FORM_FIELD_FONT_PT = 10
