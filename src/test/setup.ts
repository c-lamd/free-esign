import '@testing-library/jest-dom'

// ── Canvas 2d context mock (for signature_pad in jsdom) ──────────────────────
// signature_pad calls getContext('2d') and uses scale/clearRect/etc.
// jsdom does not implement canvas rendering — we stub it here so tests that
// render SignatureDrawModal don't throw "getContext is not a function".
// Guard: only install if not already stubbed (idempotent).
if (
  typeof HTMLCanvasElement !== 'undefined' &&
  !('_gsdCanvasMocked' in HTMLCanvasElement.prototype)
) {
  Object.defineProperty(HTMLCanvasElement.prototype, '_gsdCanvasMocked', {
    value: true,
    writable: false,
    configurable: false,
  })

  // Stub getContext — returns a minimal 2d-context-like object
  HTMLCanvasElement.prototype.getContext = function (contextId: string) {
    if (contextId !== '2d') return null
    return {
      scale: () => {},
      translate: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      fillRect: () => {},
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      canvas: this,
      save: () => {},
      restore: () => {},
      drawImage: () => {},
      getImageData: (_sx: number, _sy: number, sw: number, sh: number) => ({
        data: new Uint8ClampedArray(sw * sh * 4),
        width: sw,
        height: sh,
      }),
      putImageData: () => {},
      createImageData: (sw: number, sh: number) => ({
        data: new Uint8ClampedArray(sw * sh * 4),
        width: sw,
        height: sh,
      }),
    } as unknown as CanvasRenderingContext2D
  } as typeof HTMLCanvasElement.prototype.getContext

  // Stub toDataURL — returns a minimal but syntactically valid PNG data URL
  HTMLCanvasElement.prototype.toDataURL = function (_type?: string) {
    return 'data:image/png;base64,AAAA'
  }
}
