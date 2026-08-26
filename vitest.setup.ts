/**
 * Node 25+ may expose a global `localStorage` when `--localstorage-file` is
 * present without a valid path. That stub is not a Web Storage object
 * (`clear` is missing) and leaks across tests if it is file-backed.
 * Vitest runs with `environment: 'node'`, so we always install an in-memory
 * Storage for isolation.
 */
function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key: string) {
      return data.get(String(key)) ?? null
    },
    key(index: number) {
      return [...data.keys()][index] ?? null
    },
    removeItem(key: string) {
      data.delete(String(key))
    },
    setItem(key: string, value: string) {
      data.set(String(key), String(value))
    },
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: createMemoryStorage(),
})
