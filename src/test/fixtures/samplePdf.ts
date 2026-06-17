/**
 * Minimal valid single-page PDF (200×200 pt) as a Base64 constant.
 *
 * Generated once with:
 *   import { PDFDocument } from 'pdf-lib-incremental-save'
 *   const pdfDoc = await PDFDocument.create()
 *   pdfDoc.addPage([200, 200])
 *   const bytes = await pdfDoc.save()
 *   const base64 = Buffer.from(bytes).toString('base64')
 *
 * Decoded bytes start with "%PDF-" (verified at generation time).
 * Regenerate if pdf-lib-incremental-save produces incompatible output.
 */
export const SAMPLE_PDF_BASE64 =
  'JVBERi0xLjcKJYGBgYEKCjUgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL09ialN0bQovTiA0Ci9GaXJzdCAyMAovTGVuZ3RoIDI1OQo+PgpzdHJlYW0KeJzVUk1LxDAQvedXzFFPmaZp0pVScPtxEWFZPCl7CNuwFGSzpC3ov3emWRUP4tnDYzJ5b5JM3mSAoEBryMGWoKHIFVSVkE/vFw9y505+EvJhHCZ4IRZhDwchm7CcZ8hEXYtvbeNm9xpOIhVBxuJPxS6GYTn6CFXf9T2iRUSjCQZRtRQbwoagKCdOlbQmWH0F7dkcMb8nrk8wNtUwv2qLa31HkbSGNW3S6jLlX/fyXV06Q/31nk0t5GMYWjd7uGnvFCqDJrNYFEbp51v6jujdHP5vc+v7x3D+tcMfPrO9bHL0PAOry3Lvp7DEI9lOupr/yw+j24Y3mhrkCcOEA5MfR2KN3AplbmRzdHJlYW0KZW5kb2JqCgo2IDAgb2JqCjw8Ci9TaXplIDcKL1Jvb3QgMiAwIFIKL0luZm8gMyAwIFIKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL1hSZWYKL0xlbmd0aCAzNAovVyBbIDEgMiAyIF0KL0luZGV4IFsgMCA3IF0KPj4Kc3RyZWFtCnicFcQxDgAgCASwHsbd7/p6CB2K7nLZstV24pF8BkOGAq0KZW5kc3RyZWFtCmVuZG9iagoKc3RhcnR4cmVmCjM3NwolJUVPRg=='
