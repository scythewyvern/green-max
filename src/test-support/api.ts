import {
  createGreenApi,
  GreenApiError,
  type Fetcher,
  type GreenApiErrorKind,
  type GreenApiOptions,
} from '#/api'

export const TEST_API_OPTIONS = {
  apiUrl: 'https://api.green-api.test',
  idInstance: '1100000000',
  apiTokenInstance: 'secret-token',
  receiveTimeout: 15,
} as const

export function createTestApi(overrides: Partial<GreenApiOptions> = {}) {
  return createGreenApi({ ...TEST_API_OPTIONS, ...overrides })
}

export function getRequestUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : input instanceof URL ? input.href : input
}

export function queuedFetcher(responses: Array<Response | Promise<Response>>): Fetcher {
  return async () => {
    let response = responses.shift()
    if (!response) throw new Error('unexpected request')
    return response
  }
}

export function acknowledgementResponse(): Response {
  return Response.json({ result: true, reason: '' })
}

export function makeGreenApiError(
  overrides: Partial<{
    kind: GreenApiErrorKind
    message: string
    reason: string | null
    retryable: boolean
    status: number | null
  }> = {}
): GreenApiError {
  let kind = overrides.kind ?? 'network'
  return new GreenApiError({
    kind,
    message: overrides.message ?? (kind === 'cancelled' ? 'cancelled' : 'offline'),
    reason: overrides.reason ?? null,
    retryable: overrides.retryable ?? kind === 'network',
    status: overrides.status ?? null,
  })
}
