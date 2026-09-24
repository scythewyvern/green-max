import { describe, expect, test } from 'bun:test'

import { InvalidCredentials, parseCredentials, parseStoredCredentials } from './credentials'

const API_URL = 'https://1103.api.green-api.com'

describe('parseCredentials', () => {
  test('normalizes valid credentials', () => {
    let result = parseCredentials(' 1100000000 ', ' secret-token ', ` ${API_URL}/ `)

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toEqual({
        idInstance: '1100000000',
        apiTokenInstance: 'secret-token',
        apiUrl: API_URL,
      })
    }
  })

  test('rejects an empty instance id', () => {
    let result = parseCredentials('   ', 'secret-token', API_URL)

    expect(result.status).toBe('error')
    if (result.status === 'error' && InvalidCredentials.is(result.error)) {
      expect(result.error.message).toContain('instance ID')
    }
  })

  test('accepts instance ids of any length', () => {
    let result = parseCredentials('not-10-digits', 'secret-token', API_URL)

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value.idInstance).toBe('not-10-digits')
    }
  })

  test('rejects an invalid api url', () => {
    let result = parseCredentials('1100000000', 'secret-token', 'not-a-url')

    expect(result.status).toBe('error')
    if (result.status === 'error' && InvalidCredentials.is(result.error)) {
      expect(result.error.message).toContain('API URL')
    }
  })
})

describe('parseStoredCredentials', () => {
  test('normalizes a complete stored configuration', () => {
    let credentials = parseStoredCredentials({
      idInstance: ' 3100 ',
      apiTokenInstance: ' secret-token ',
      apiUrl: ` ${API_URL}/ `,
    })

    expect(credentials).toEqual({
      idInstance: '3100',
      apiTokenInstance: 'secret-token',
      apiUrl: API_URL,
    })
  })

  test('requires a stored api url', () => {
    for (let apiUrl of [undefined, '   ']) {
      expect(
        parseStoredCredentials({
          idInstance: ' 3100 ',
          apiTokenInstance: ' secret-token ',
          apiUrl,
        })
      ).toBeNull()
    }
  })

  test('rejects a malformed stored api url', () => {
    expect(
      parseStoredCredentials({
        idInstance: '3100',
        apiTokenInstance: 'secret-token',
        apiUrl: 'not-a-url',
      })
    ).toBeNull()
  })
})
