/**
 * fieldStore.ts
 *
 * Field data model and Zustand store for placed signature/annotation fields.
 *
 * Phase 3 extends the union to support all five field types:
 *   'signature' | 'initials' | 'date' | 'text' | 'checkbox'
 *
 * Exports PlacedField, FieldType, and PageDimensions types consumed by
 * exportPdf.ts and field placement UI components.
 *
 * MP-01 seam: PlacedField.role is reserved for v2 multi-party routing.
 *
 * History invariant: the first push seeds history[0] as the pre-action snapshot.
 * undo() restores history[historyIndex-1]; redo() restores history[historyIndex+1].
 * historyIndex <= 0 means no further undo is possible.
 */

import { create } from 'zustand'

// ---------- Types (consumed by exportPdf.ts and downstream plans) ----------

export type FieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox'

export interface PlacedField {
  id: string // crypto.randomUUID()
  type: FieldType // Phase 3: full union
  pageNumber: number // 1-indexed
  pdfX: number // PDF user-space, bottom-left origin, points
  pdfY: number
  pdfWidth: number
  pdfHeight: number
  dataUrl?: string // image types only (signature, initials); optional
  textValue?: string // date and text fields; checkbox has neither
  role?: string // v2 multi-party seam (MP-01) — reserved, unused in Phase 2/3
}

export interface PageDimensions {
  originalWidth: number // PDF points at scale 1 (from react-pdf Page onLoadSuccess)
  originalHeight: number
  scale: number // containerWidth / originalWidth
}

// ---------- History cap constant ----------

const MAX_HISTORY = 50

// ---------- Store shape ----------

interface FieldStore {
  // Signature draw modal
  modalOpen: boolean
  signatureDataUrl: string | null

  // Placement (Phase 3: replaces placementMode: boolean)
  armedFieldType: FieldType | null

  // Initials seam (consumed by Plan 04 InitialsDrawModal)
  initialsDataUrl: string | null
  initialsModalOpen: boolean

  // Fields
  fields: PlacedField[]
  selectedFieldId: string | null

  // Page dimensions (needed for CSS ↔ PDF coordinate conversion)
  pageDimensions: Map<number, PageDimensions>

  // Undo/redo history stack
  history: PlacedField[][]
  historyIndex: number

  // Actions
  openModal: () => void
  closeModal: () => void
  setSignatureDataUrl: (url: string | null) => void
  setArmedFieldType: (type: FieldType | null) => void
  setInitialsDataUrl: (url: string | null) => void
  openInitialsModal: () => void
  closeInitialsModal: () => void
  addField: (field: PlacedField) => void
  updateField: (id: string, updates: Partial<PlacedField>) => void
  deleteField: (id: string) => void
  setSelectedFieldId: (id: string | null) => void
  setPageDimensions: (pageNumber: number, dims: PageDimensions) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  resetFields: () => void
}

// ---------- Initial state (extracted for reset) ----------

const initialFieldState = {
  modalOpen: false,
  signatureDataUrl: null,
  armedFieldType: null as FieldType | null,
  initialsDataUrl: null as string | null,
  initialsModalOpen: false,
  fields: [] as PlacedField[],
  selectedFieldId: null as string | null,
  pageDimensions: new Map<number, PageDimensions>(),
  history: [] as PlacedField[][],
  historyIndex: -1,
}

// ---------- Store ----------

export const useFieldStore = create<FieldStore>()((set) => ({
  ...initialFieldState,

  openModal: () => set({ modalOpen: true }),
  closeModal: () => set({ modalOpen: false }),

  setSignatureDataUrl: (signatureDataUrl) => set({ signatureDataUrl }),

  setArmedFieldType: (armedFieldType) => set({ armedFieldType }),

  setInitialsDataUrl: (initialsDataUrl) => set({ initialsDataUrl }),

  openInitialsModal: () => set({ initialsModalOpen: true }),
  closeInitialsModal: () => set({ initialsModalOpen: false }),

  // pushHistory — snapshot current fields before a mutation.
  // Invariant: history[historyIndex] is the "before" state before the next undo.
  // Slices off the redo tail (anything after historyIndex), appends the snapshot,
  // then bounds to MAX_HISTORY.
  pushHistory: () =>
    set((state) => {
      const snapshot = [...state.fields]
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(snapshot)
      const bounded = newHistory.slice(-MAX_HISTORY)
      return { history: bounded, historyIndex: bounded.length - 1 }
    }),

  // addField: push a pre-add snapshot first, then append the new field.
  // This seeds history[0] as the empty state so undo can fully revert.
  addField: (field) =>
    set((state) => {
      // Snapshot the pre-add state (redo tail truncated)
      const preMutation = [...state.fields]
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(preMutation)
      const bounded = newHistory.slice(-MAX_HISTORY)
      // Append the new field
      const newFields = [...state.fields, field]
      // Push the post-add state too so redo can re-apply
      const withPostState = bounded.slice(0, bounded.length)
      withPostState.push([...newFields])
      const bounded2 = withPostState.slice(-MAX_HISTORY)
      return {
        fields: newFields,
        history: bounded2,
        historyIndex: bounded2.length - 1,
      }
    }),

  updateField: (id, updates) =>
    set((state) => ({
      fields: state.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),

  // deleteField: push a pre-delete snapshot first, then remove the field.
  deleteField: (id) =>
    set((state) => {
      // Snapshot the pre-delete state
      const preMutation = [...state.fields]
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(preMutation)
      const bounded = newHistory.slice(-MAX_HISTORY)
      // Remove the field
      const newFields = state.fields.filter((f) => f.id !== id)
      // Push the post-delete state
      const withPostState = [...bounded, [...newFields]]
      const bounded2 = withPostState.slice(-MAX_HISTORY)
      return {
        fields: newFields,
        history: bounded2,
        historyIndex: bounded2.length - 1,
        // FLD-07: deleting the selected field clears the selection
        selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
      }
    }),

  // undo — restores fields to history[historyIndex - 1]; no-op if at baseline.
  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return {}
      const newIndex = state.historyIndex - 1
      return {
        fields: [...state.history[newIndex]],
        historyIndex: newIndex,
        selectedFieldId: null, // clear selection on undo (avoids dangling ref)
      }
    }),

  // redo — restores fields to history[historyIndex + 1]; no-op if at end.
  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return {}
      const newIndex = state.historyIndex + 1
      return {
        fields: [...state.history[newIndex]],
        historyIndex: newIndex,
        selectedFieldId: null,
      }
    }),

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
