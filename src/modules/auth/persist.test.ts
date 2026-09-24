import { afterEach, describe, expect, test } from 'bun:test'

import { createMemoryStorage, stubStorage } from '#/test-support/storage'

import { clearApiCredentials, loadApiCredentials, persistApiCredentials } from './persist'

const CREDENTIALS = {
  idInstance: '1100000000',
  apiTokenInstance: 'secret-token',
  apiUrl: 'https://1103.api.green-api.com',
} as const

afterEach(() => {
  try {
    clearApiCredentials()
  } catch {
    // Storage may be stubbed to throw; ignore cleanup failures.
  }
})

describe('auth persist', () => {
  test('round-trips credentials through a single key', () => {
    let { restore } = createMemoryStorage()
    try {
      persistApiCredentials({ ...CREDENTIALS })
      expect(loadApiCredentials()).toEqual({ ...CREDENTIALS })
    } finally {
      restore()
    }
  })

  test('load returns null and persist is a no-op when storage throws', () => {
    let restore = stubStorage({
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    try {
      expect(() => persistApiCredentials({ ...CREDENTIALS })).not.toThrow()
      expect(loadApiCredentials()).toBeNull()
    } finally {
      restore()
    }
  })

  test('invalid stored values stay untouched and count as logged out', () => {
    let raw = JSON.stringify({ idInstance: 'bad', apiTokenInstance: '', apiUrl: 'x' })
    let { store, restore } = createMemoryStorage({ 'green::credentials': raw })
    try {
      expect(loadApiCredentials()).toBeNull()
      expect(store.get('green::credentials')).toBe(raw)
    } finally {
      restore()
    }
  })

  test('invalid stored api urls stay untouched and count as logged out', () => {
    let raw = JSON.stringify({
      idInstance: '1100000000',
      apiTokenInstance: 'secret-token',
      apiUrl: 'not-a-url',
    })
    let { store, restore } = createMemoryStorage({ 'green::credentials': raw })
    try {
      expect(loadApiCredentials()).toBeNull()
      expect(store.get('green::credentials')).toBe(raw)
    } finally {
      restore()
    }
  })

  test('keeps credentials whose id is not 10 digits', () => {
    let { restore } = createMemoryStorage({
      'green::credentials': JSON.stringify({
        idInstance: '3100',
        apiTokenInstance: 'secret-token',
        apiUrl: 'https://3100.api.green-api.com',
      }),
    })
    try {
      expect(loadApiCredentials()).toEqual({
        idInstance: '3100',
        apiTokenInstance: 'secret-token',
        apiUrl: 'https://3100.api.green-api.com',
      })
    } finally {
      restore()
    }
  })
})
