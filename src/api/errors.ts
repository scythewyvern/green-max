import { TaggedError } from 'better-result'

export type GreenApiErrorKind =
  | 'network'
  | 'http'
  | 'invalid-response'
  | 'service'
  | 'cancelled'

export class GreenApiError extends TaggedError('GreenApiError')<{
  kind: GreenApiErrorKind
  message: string
  reason: string | null
  retryable: boolean
  status: number | null
}> {}

export function createServiceError(reason: string): GreenApiError {
  return new GreenApiError({
    kind: 'service',
    message: reason,
    reason,
    retryable: false,
    status: null,
  })
}

export function createInvalidResponseError(message: string): GreenApiError {
  return new GreenApiError({
    kind: 'invalid-response',
    message,
    reason: null,
    retryable: false,
    status: null,
  })
}

export function createTimeoutError(): GreenApiError {
  return new GreenApiError({
    kind: 'network',
    message: 'GREEN-API request timed out',
    reason: null,
    retryable: true,
    status: null,
  })
}

export function createCancelledError(): GreenApiError {
  return new GreenApiError({
    kind: 'cancelled',
    message: 'GREEN-API request was cancelled',
    reason: null,
    retryable: false,
    status: null,
  })
}

export function createNetworkError(): GreenApiError {
  return new GreenApiError({
    kind: 'network',
    message: 'GREEN-API request failed',
    reason: null,
    retryable: true,
    status: null,
  })
}

export function describeApiError(error: GreenApiError): string {
  switch (error.kind) {
    case 'cancelled':
      return 'The request was cancelled. Try again.'
    case 'network':
      return 'Unable to reach GREEN-API. Check your connection and try again.'
    case 'http':
      return `GREEN-API is unavailable (${error.status ?? 'unknown error'}). Try again.`
    case 'service':
      return error.reason ?? error.message
    case 'invalid-response':
      return 'GREEN-API returned an unexpected response. Try again.'
  }
}
