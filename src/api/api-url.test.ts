import { describe, expect, test } from 'bun:test'

import { parseApiUrlInput } from './index'

describe('parseApiUrlInput', () => {
  test('normalizes a valid per-instance url', () => {
    expect(parseApiUrlInput(' https://3103.api.green-api.com/// ')).toBe(
      'https://3103.api.green-api.com'
    )
  })

  test('rejects malformed, insecure, and ambiguous urls', () => {
    expect(parseApiUrlInput('not-a-url')).toBeNull()
    expect(parseApiUrlInput('ftp://example.com')).toBeNull()
    expect(parseApiUrlInput('http://example.com')).toBeNull()
    expect(parseApiUrlInput('https://example.com?token=wrong')).toBeNull()
    expect(parseApiUrlInput('https://example.com#fragment')).toBeNull()
    expect(parseApiUrlInput('https://user:password@example.com')).toBeNull()
  })

  test('allows http only for loopback development hosts', () => {
    expect(parseApiUrlInput('http://localhost:3000')).toBe('http://localhost:3000')
    expect(parseApiUrlInput('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000')
    expect(parseApiUrlInput('http://[::1]:3000')).toBe('http://[::1]:3000')
  })
})
