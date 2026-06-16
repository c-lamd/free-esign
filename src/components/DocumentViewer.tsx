// Import pdfWorker first — sets GlobalWorkerOptions.workerSrc before react-pdf initialises
// (RESEARCH Pitfall 3: module execution order can overwrite workerSrc)
import '../lib/pdfWorker'
import { pdfOptions } from '../lib/pdfWorker'

import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
// TextLayer.css intentionally NOT imported — renderTextLayer={false} in Phase 1

import { useCallback, useState } from 'react'
import { useDocumentStore } from '../store/documentStore'

export function DocumentViewer() {
  const docUrl = useDocumentStore((s) => s.docUrl)
  const setNumPages = useDocumentStore((s) => s.setNumPages)
  const setError = useDocumentStore((s) => s.setError)

  const [containerWidth, setContainerWidth] = useState<number | undefined>(
    undefined,
  )

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  if (!docUrl) return null

  return (
    <div
      style={{
        backgroundColor: 'var(--color-canvas)',
        minHeight: 'calc(100dvh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '24px',
        paddingBottom: '24px',
        overflowY: 'auto',
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: '900px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Document
          file={docUrl}
          options={pdfOptions}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() =>
            setError(
              "This file couldn't be read. It may be corrupt or password-protected. Try another file.",
            )
          }
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            <Page
              pageNumber={1}
              width={containerWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        </Document>
      </div>
    </div>
  )
}
