import { parseStoredCredentials, type StoredCredentials } from './credentials'

const STORAGE_KEY = 'green::credentials'

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode, blocked cookies, quota).
    // Persist becomes a no-op so the app keeps working in memory.
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore: clearing must never crash the app.
  }
}

export function persistApiCredentials(credentials: StoredCredentials): void {
  writeStorage(STORAGE_KEY, JSON.stringify(credentials))
}

// Loading never deletes stored data. Values are validated and normalized only
// in memory; explicit logout is the only operation that clears storage.
export function loadApiCredentials(): StoredCredentials | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }

  if (typeof raw !== 'string' || !raw) return null

  try {
    return parseStoredCredentials(JSON.parse(raw))
  } catch {
    // Corrupt JSON: treat as logged out, leave storage untouched.
    return null
  }
}

export function clearApiCredentials(): void {
  removeStorage(STORAGE_KEY)
}
