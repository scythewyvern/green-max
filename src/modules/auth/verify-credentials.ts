import { describeApiError, type GreenApi } from '#/api'

import type { Credentials } from './credentials'

export type CredentialApi = Pick<GreenApi, 'getStateInstance'>
export type CredentialApiFactory = (credentials: Credentials) => CredentialApi

export type CredentialVerificationResult =
  | { kind: 'success' }
  | { kind: 'error'; message: string }

export async function verifyCredentials(
  credentials: Credentials,
  createApi: CredentialApiFactory
): Promise<CredentialVerificationResult> {
  let stateResult = await createApi(credentials).getStateInstance()

  return stateResult.match({
    ok: ({ stateInstance }) => {
      if (stateInstance !== 'authorized') {
        return {
          kind: 'error',
          message: `Instance is not authorized (state: ${stateInstance}). Scan QR in console.`,
        }
      }

      return { kind: 'success' }
    },
    err: (error) => {
      if (error.kind === 'http' && (error.status === 401 || error.status === 403)) {
        return { kind: 'error', message: 'Invalid instance ID or token.' }
      }

      return { kind: 'error', message: describeApiError(error) }
    },
  })
}
