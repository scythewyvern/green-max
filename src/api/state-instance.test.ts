import { describe, expect, test } from 'bun:test'

import { createTestApi, getRequestUrl } from '#/test-support/api'

import { GreenApiError } from './index'

describe('Api.getStateInstance', () => {
  test('returns the authorized state', async () => {
    let requestUrl = ''
    let api = createTestApi({
      fetcher: async (input) => {
        requestUrl = getRequestUrl(input)
        return Response.json({ stateInstance: 'authorized' })
      },
    })

    let result = await api.getStateInstance()

    expect(requestUrl).toBe(
      'https://api.green-api.test/waInstance1100000000/getStateInstance/secret-token'
    )
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value.stateInstance).toBe('authorized')
    }
  })

  test('surfaces non-authorized states for the caller to reject', async () => {
    let api = createTestApi({
      fetcher: async () => Response.json({ stateInstance: 'notAuthorized' }),
    })

    let result = await api.getStateInstance()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value.stateInstance).not.toBe('authorized')
    }
  })

  test('rejects malformed state responses', async () => {
    let api = createTestApi({
      fetcher: async () => Response.json({ unexpected: true }),
    })

    let result = await api.getStateInstance()

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('invalid-response')
    }
  })
})
