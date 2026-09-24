import { describe, expect, test } from 'bun:test'

import { Result } from 'better-result'

import { makeGreenApiError } from '#/test-support/api'

import { resolveRecipient } from './resolve-recipient'

function apiReturning(
  result: Awaited<
    ReturnType<NonNullable<Parameters<typeof resolveRecipient>[0]>['checkAccount']>
  >
) {
  return {
    checkAccount: async () => result,
  }
}

describe('resolveRecipient', () => {
  test('returns the resolved chat id for a MAX account', async () => {
    let request: unknown
    let api = {
      checkAccount: async (body: unknown) => {
        request = body
        return Result.ok({ kind: 'found' as const, chatId: '10000000' })
      },
    }

    let result = await resolveRecipient(api, 79991234567)

    expect(result).toEqual({ kind: 'success', chatId: '10000000' })
    expect(request).toEqual({ phoneNumber: 79991234567, force: true })
  })

  test('reports when no MAX account exists', async () => {
    let result = await resolveRecipient(
      apiReturning(Result.ok({ kind: 'not_found' as const })),
      79991234567
    )

    expect(result).toEqual({
      kind: 'error',
      message: 'No MAX account was found for this number.',
    })
  })

  test('requires authenticated API access', async () => {
    expect(await resolveRecipient(null, 79991234567)).toEqual({
      kind: 'error',
      message: 'Credentials are not available. Sign in again.',
    })
  })

  test('describes recipient lookup failures', async () => {
    let result = await resolveRecipient(
      apiReturning(Result.err(makeGreenApiError())),
      79991234567
    )

    expect(result).toEqual({
      kind: 'error',
      message: 'Unable to reach GREEN-API. Check your connection and try again.',
    })
  })
})
