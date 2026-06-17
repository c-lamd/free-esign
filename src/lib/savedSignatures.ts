/**
 * savedSignatures.ts
 *
 * Pure I/O utility for persisting saved signature/initials items to IndexedDB
 * via idb-keyval. No React imports — this module is only concerned with the
 * read/write layer.
 *
 * All items are stored under a single key ('savedSignatureItems') as an array,
 * ordered newest-first. Read-modify-write is used for add/delete operations.
 *
 * Security note: fontFamily stored in SavedItem is a string label only (e.g.,
 * "Dancing Script"). Font bytes are always loaded from the static public/fonts/
 * allowlist at export time — never from user-supplied bytes (T-04-01).
 */

import { get, set } from 'idb-keyval'
import type { SavedItem } from '../store/fieldStore'

// Single key under which all saved items are stored.
// Exported for use in tests asserting the correct IDB key.
export const IDB_KEY = 'savedSignatureItems'

/**
 * Load all saved items from IndexedDB.
 * Returns an empty array if nothing has been stored yet.
 */
export async function loadAll(): Promise<SavedItem[]> {
  return (await get<SavedItem[]>(IDB_KEY)) ?? []
}

/**
 * Persist a new item to IndexedDB, prepending it to keep newest-first order.
 */
export async function addItem(item: SavedItem): Promise<void> {
  const current = await loadAll()
  await set(IDB_KEY, [item, ...current])
}

/**
 * Remove an item by id from IndexedDB.
 */
export async function deleteItem(id: string): Promise<void> {
  const current = await loadAll()
  await set(IDB_KEY, current.filter((i) => i.id !== id))
}
