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
 * History invariant: history[0] is seeded with the empty-document state; each user
 * action appends exactly ONE entry (post-mutation for add/delete; pre-mutation for
 * drag/resize/text-blur via pushHistory). historyIndex points to the current state.
 * undo() restores history[historyIndex-1]; redo() restores history[historyIndex+1].
 * historyIndex <= 0 means no further undo is possible (at the baseline empty state).
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

// ---------- History helpers ----------

/**
 * Appends a single snapshot to a history array and bounds it to MAX_HISTORY.
 * Returns [newHistory, newHistoryIndex].
 *
 * This implements a single-state-per-operation model:
 *   - addField/deleteField push the POST-mutation state.
 *   - pushHistory (before drag/resize/text blur) pushes the PRE-mutation state.
 * Each user action = exactly one entry = exactly one undo step.
 */
function appendSnapshot(
  history: PlacedField[][],
  historyIndex: number,
  snapshot: PlacedField[],
): [PlacedField[][], number] {
  const truncated = history.slice(0, historyIndex + 1)
  truncated.push(snapshot)
  const bounded = truncated.slice(-MAX_HISTORY)
  return [bounded, bounded.length - 1]
}

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
  // History is seeded with one empty-state snapshot so that the undo guard
  // (historyIndex <= 0) correctly prevents undo past the initial state.
  // Each user action appends exactly ONE entry (post-mutation state for
  // add/delete; pre-mutation state for drag/resize/text-blur via pushHistory).
  history: [[]] as PlacedField[][],
  historyIndex: 0,
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

  // pushHistory — snapshot current fields BEFORE a mutation (drag/resize/text-blur).
  // Called by drag/resize/blur handlers before updateField().
  // Undo restores history[historyIndex - 1] which is the state just before this snapshot.
  // Note: the post-mutation state is NOT stored in history, so redo after drag/resize
  // restores the same pre-drag state (redo of drag/resize is intentionally not supported).
  pushHistory: () =>
    set((state) => {
      const snapshot = [...state.fields]
      const [newHistory, newIndex] = appendSnapshot(state.history, state.historyIndex, snapshot)
      return { history: newHistory, historyIndex: newIndex }
    }),

  // addField: append the new field and push exactly ONE post-mutation snapshot.
  // One user action = one history entry = one undo step.
  // The initial seeded history[0] = [] acts as the "empty document" baseline
  // that undo can never go past (historyIndex <= 0 guard in undo()).
  addField: (field) =>
    set((state) => {
      const newFields = [...state.fields, field]
      const [newHistory, newIndex] = appendSnapshot(state.history, state.historyIndex, [...newFields])
      return {
        fields: newFields,
        history: newHistory,
        historyIndex: newIndex,
      }
    }),

  updateField: (id, updates) =>
    set((state) => ({
      fields: state.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),

  // deleteField: remove the field and push exactly ONE post-mutation snapshot.
  // One user action = one history entry = one undo step.
  deleteField: (id) =>
    set((state) => {
      const newFields = state.fields.filter((f) => f.id !== id)
      const [newHistory, newIndex] = appendSnapshot(state.history, state.historyIndex, [...newFields])
      return {
        fields: newFields,
        history: newHistory,
        historyIndex: newIndex,
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
