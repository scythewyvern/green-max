type StorageOverrides = Partial<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>>

export function stubStorage(impl: StorageOverrides = {}): () => void {
  let original = (globalThis as Record<string, unknown>).localStorage
  ;(globalThis as Record<string, unknown>).localStorage = {
    length: 0,
    clear: () => {},
    key: () => null,
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    ...impl,
  } as Storage

  return () => {
    ;(globalThis as Record<string, unknown>).localStorage = original
  }
}

export function createMemoryStorage(initial: Record<string, string> = {}) {
  let store = new Map(Object.entries(initial))
  let restore = stubStorage({
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  })

  return { store, restore }
}
