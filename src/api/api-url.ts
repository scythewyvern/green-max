function normalizeApiUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

function isLoopbackHostname(hostname: string): boolean {
  let normalized = hostname.toLowerCase()
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized === '::1'
  )
}

function isApiUrlValid(normalized: string): boolean {
  try {
    let parsed = new URL(normalized)
    if (parsed.search || parsed.hash || parsed.username || parsed.password) return false

    if (parsed.protocol === 'https:') return true
    return parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname)
  } catch {
    return false
  }
}

export function parseApiUrlInput(input: unknown): string | null {
  if (typeof input !== 'string') return null

  let normalized = normalizeApiUrl(input)
  if (!normalized) return null
  if (!isApiUrlValid(normalized)) return null

  return normalized
}
