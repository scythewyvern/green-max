import { parseApiUrlInput } from './api'

const apiUrl = import.meta.env.PUBLIC_API_URL

if (typeof apiUrl !== 'string' || !apiUrl.trim()) {
  throw new Error('Missing environment variable: PUBLIC_API_URL')
}

let normalizedApiUrl = parseApiUrlInput(apiUrl)

if (!normalizedApiUrl) {
  throw new Error('PUBLIC_API_URL must use HTTPS, except for loopback HTTP')
}

export const env = {
  API_URL: normalizedApiUrl,
} as const
