import { describe, expect, test } from 'bun:test'

import { Result } from 'better-result'

import { makeGreenApiError } from '#/test-support/api'

import type { Credentials } from './credentials'
import { verifyCredentials } from './verify-credentials'

const CREDENTIALS: Credentials = {
  idInstance: '1100000000',
  apiTokenInstance: 'secret-token',
  apiUrl: 'https://api.green-api.test',
}

describe('verifyCredentials', () => {
  test('accepts an authorized instance and passes credentials to the API factory', async () => {
    let received: Credentials[] = []
    let result = await verifyCredentials(CREDENTIALS, (credentials) => {
      received.push(credentials)
      return {
        getStateInstance: async () => Result.ok({ stateInstance: 'authorized' }),
      }
    })

    expect(result).toEqual({ kind: 'success' })
    expect(received).toEqual([CREDENTIALS])
  })

  test('reports a non-authorized instance', async () => {
    let result = await verifyCredentials(CREDENTIALS, () => ({
      getStateInstance: async () => Result.ok({ stateInstance: 'notAuthorized' }),
    }))

    expect(result).toEqual({
      kind: 'error',
      message: 'Instance is not authorized (state: notAuthorized). Scan QR in console.',
    })
  })

  test('uses the invalid-credentials message for 401 and 403 responses', async () => {
    for (let status of [401, 403]) {
      let result = await verifyCredentials(CREDENTIALS, () => ({
        getStateInstance: async () =>
          Result.err(makeGreenApiError({ kind: 'http', message: 'unauthorized', status })),
      }))

      expect(result).toEqual({ kind: 'error', message: 'Invalid instance ID or token.' })
    }
  })

  test('describes other verification failures', async () => {
    let result = await verifyCredentials(CREDENTIALS, () => ({
      getStateInstance: async () => Result.err(makeGreenApiError()),
    }))

    expect(result).toEqual({
      kind: 'error',
      message: 'Unable to reach GREEN-API. Check your connection and try again.',
    })
  })
})
