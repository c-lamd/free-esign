/**
 * fieldStore.ts
 *
 * Field data model and Zustand store for placed signature fields.
 *
 * Exports PlacedField and PageDimensions types consumed by exportPdf.ts (Plan 02-01)
 * and the field placement UI components (Plans 02-02, 02-03).
 *
 * MP-01 seam: PlacedField.role is reserved for v2 multi-party routing.
 * It is present in the type but never set in Phase 2.
 */

import { create } from 'zustand'

// ---------- Types (consumed by exportPdf.ts and downstream plans) ----------

export interface PlacedField {
  id: string // crypto.randomUUID()
  type: 'signature' // Phase 3 extends: 'initials' | 'date' | 'text' | 'checkbox'
  pageNumber: number // 1-indexed
  pdfX: number // PDF user-space, bottom-left origin, points
  pdfY: number
  pdfWidth: number
  pdfHeight: number
  dataUrl: string // transparent-background PNG data URL
  role?: string // v2 multi-party seam (MP-01) — reserved, unused in Phase 2
}

export interface PageDimensions {
  originalWidth: number // PDF points at scale 1 (from react-pdf Page onLoadSuccess)
  originalHeight: number
  scale: number // containerWidth / originalWidth
}

// ---------- Store shape ----------

interface FieldStore {
  // Signature draw modal
  modalOpen: boolean
  signatureDataUrl: string | null

  // Placement
  placementMode: boolean

  // Fields
  fields: PlacedField[]
  selectedFieldId: string | null

  // Page dimensions (needed for CSS ↔ PDF coordinate conversion)
  pageDimensions: Map<number, PageDimensions>

  // Actions
  openModal: () => void
  closeModal: () => void
  setSignatureDataUrl: (url: string | null) => void
  setPlacementMode: (active: boolean) => void
  addField: (field: PlacedField) => void
  updateField: (id: string, updates: Partial<PlacedField>) => void
  deleteField: (id: string) => void
  setSelectedFieldId: (id: string | null) => void
  setPageDimensions: (pageNumber: number, dims: PageDimensions) => void
  resetFields: () => void
}

// ---------- Initial state (extracted for reset) ----------

const initialFieldState = {
  modalOpen: false,
  signatureDataUrl: null,
  placementMode: false,
  fields: [] as PlacedField[],
  selectedFieldId: null,
  pageDimensions: new Map<number, PageDimensions>(),
}

// ---------- Store ----------

export const useFieldStore = create<FieldStore>()((set) => ({
  ...initialFieldState,

  openModal: () => set({ modalOpen: true }),
  closeModal: () => set({ modalOpen: false }),

  setSignatureDataUrl: (signatureDataUrl) => set({ signatureDataUrl }),

  setPlacementMode: (placementMode) => set({ placementMode }),

  addField: (field) =>
    set((state) => ({
      fields: [...state.fields, field],
    })),

  updateField: (id, updates) =>
    set((state) => ({
      fields: state.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),

  deleteField: (id) =>
    set((state) => ({
      fields: state.fields.filter((f) => f.id !== id),
      // FLD-07: deleting the selected field clears the selection
      selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
    })),

  setSelectedFieldId: (selectedFieldId) => set({ selectedFieldId }),

  setPageDimensions: (pageNumber, dims) =>
    set((state) => {
      // Map must be replaced (not mutated) to trigger Zustand re-renders
      const next = new Map(state.pageDimensions)
      next.set(pageNumber, dims)
      return { pageDimensions: next }
    }),

  resetFields: () =>
    set({
      ...initialFieldState,
      // New Map instance so pageDimensions identity resets cleanly
      pageDimensions: new Map(),
    }),
}))
