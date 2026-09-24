import { describeApiError, type GreenApi } from '#/api'

export type RecipientApi = Pick<GreenApi, 'checkAccount'>

export type RecipientResolutionResult =
  | { kind: 'success'; chatId: string }
  | { kind: 'error'; message: string }

export async function resolveRecipient(
  api: RecipientApi | null,
  phoneNumber: number
): Promise<RecipientResolutionResult> {
  if (!api) {
    return { kind: 'error', message: 'Credentials are not available. Sign in again.' }
  }

  let result = await api.checkAccount({ phoneNumber, force: true })

  return result.match({
    ok: (account) => {
      if (account.kind === 'not_found') {
        return { kind: 'error', message: 'No MAX account was found for this number.' }
      }

      return { kind: 'success', chatId: account.chatId }
    },
    err: (error) => ({ kind: 'error', message: describeApiError(error) }),
  })
}
