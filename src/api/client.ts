import { Result, type Result as ResultType } from 'better-result'

import { parseApiUrlInput } from './api-url'
import {
  createCancelledError,
  createInvalidResponseError,
  createNetworkError,
  createServiceError,
  createTimeoutError,
  GreenApiError,
} from './errors'
import type {
  CheckAccountBody,
  CheckAccountResult,
  Fetcher,
  GreenApi,
  GreenApiOptions,
  ReceiveNotificationResponse,
  SendMessageBody,
  SendMessageResponse,
  StateInstanceResponse,
  UndecodableNotification,
} from './interface'
import {
  CheckAccountFailureSchema,
  CheckAccountResponseSchema,
  checkAccountFailureMessage,
  DeleteNotificationResponseSchema,
  NotificationFailureSchema,
  NotificationSchema,
  ReceiptIdOnlySchema,
  SendMessageResponseSchema,
  StateInstanceResponseSchema,
  decode,
  notificationFailureMessage,
  toCheckAccountResult,
  toNotificationResponse,
} from './schemas'

const RECEIVE_TIMEOUT_SECONDS = 15
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000
const INVALID_CHECK_ACCOUNT_RESPONSE = 'GREEN-API returned an invalid CheckAccount response'
const INVALID_NOTIFICATION_RESPONSE = 'GREEN-API returned an invalid notification response'

type ApiEndpoint =
  | 'sendMessage'
  | 'receiveNotification'
  | 'deleteNotification'
  | 'checkAccount'
  | 'getStateInstance'

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 499 || status >= 500
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required`)
  }
}

function assertReceiveTimeout(value: number): void {
  if (!Number.isInteger(value) || value < 5 || value > 60) {
    throw new Error('receiveTimeout must be an integer between 5 and 60 seconds')
  }
}

function assertRequestTimeout(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('requestTimeoutMs must be a positive integer')
  }
}

export class Api implements GreenApi {
  #apiUrl: string
  #idInstance: string
  #apiTokenInstance: string
  #receiveTimeout: number
  #requestTimeoutMs: number
  #fetcher: Fetcher

  #endpoints: {
    sendMessage: string
    receiveNotification: string
    checkAccount: string
    getStateInstance: string
    deleteNotification: (params: { receiptId: number }) => string
  }

  constructor(options: GreenApiOptions) {
    assertNonEmptyString(options.idInstance, 'Instance ID')
    assertNonEmptyString(options.apiTokenInstance, 'API token')

    let apiUrl = parseApiUrlInput(options.apiUrl)
    if (!apiUrl) {
      throw new Error('API URL must be a valid HTTPS URL or loopback HTTP URL')
    }

    let receiveTimeout = options.receiveTimeout ?? RECEIVE_TIMEOUT_SECONDS
    let requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    assertReceiveTimeout(receiveTimeout)
    assertRequestTimeout(requestTimeoutMs)

    if (options.fetcher !== undefined && typeof options.fetcher !== 'function') {
      throw new Error('fetcher must be a function')
    }

    this.#apiUrl = apiUrl
    this.#idInstance = options.idInstance
    this.#apiTokenInstance = options.apiTokenInstance
    this.#receiveTimeout = receiveTimeout
    this.#requestTimeoutMs = requestTimeoutMs
    this.#fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis)

    this.#endpoints = {
      sendMessage: this.#getEndpointBase('sendMessage'),
      checkAccount: this.#getEndpointBase('checkAccount'),
      getStateInstance: this.#getEndpointBase('getStateInstance'),
      receiveNotification:
        this.#getEndpointBase('receiveNotification') +
        `?receiveTimeout=${this.#receiveTimeout}`,
      deleteNotification: ({ receiptId }) => {
        return `${this.#getEndpointBase('deleteNotification')}/${receiptId}`
      },
    }
  }

  async checkAccount(
    body: CheckAccountBody
  ): Promise<ResultType<CheckAccountResult, GreenApiError>> {
    return this.#requestJson(
      this.#endpoints.checkAccount,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      },
      (value) => {
        let failure = decode(CheckAccountFailureSchema, value, INVALID_CHECK_ACCOUNT_RESPONSE)
        if (failure.status === 'ok') {
          let reason = checkAccountFailureMessage(failure.value)
          return Result.err(createServiceError(reason))
        }

        return decode(CheckAccountResponseSchema, value, INVALID_CHECK_ACCOUNT_RESPONSE).map(
          toCheckAccountResult
        )
      }
    )
  }

  async getStateInstance(): Promise<ResultType<StateInstanceResponse, GreenApiError>> {
    return this.#requestJson(this.#endpoints.getStateInstance, { method: 'GET' }, (value) =>
      decode(
        StateInstanceResponseSchema,
        value,
        'GREEN-API returned an invalid StateInstance response'
      )
    )
  }

  async deleteNotification(
    receiptId: number,
    signal?: AbortSignal
  ): Promise<ResultType<void, GreenApiError>> {
    return this.#requestJson(
      this.#endpoints.deleteNotification({ receiptId }),
      { method: 'DELETE', signal },
      (value) => {
        let parsed = decode(
          DeleteNotificationResponseSchema,
          value,
          'GREEN-API returned an invalid DeleteNotification response'
        )
        if (parsed.status === 'error') return parsed.map(() => undefined)

        if (!parsed.value.result) {
          let reason =
            typeof parsed.value.reason === 'string' && parsed.value.reason
              ? parsed.value.reason
              : 'Notification was not deleted'
          return Result.err(createServiceError(reason))
        }

        return Result.ok(undefined)
      }
    )
  }

  async receiveNotification(
    signal?: AbortSignal
  ): Promise<
    ResultType<ReceiveNotificationResponse | UndecodableNotification | null, GreenApiError>
  > {
    let textResult = await this.#requestText(
      this.#endpoints.receiveNotification,
      { method: 'GET', signal },
      [408],
      (this.#receiveTimeout + 10) * 1000
    )

    return textResult.andThen((text) => {
      if (!text.trim()) return Result.ok(null)

      return parseJson(text, 'GREEN-API returned malformed notification JSON').andThen(
        (value) => {
          if (value === null) return Result.ok(null)

          let failure = decode(NotificationFailureSchema, value, INVALID_NOTIFICATION_RESPONSE)
          if (failure.status === 'ok') {
            let message = notificationFailureMessage(failure.value)
            return Result.err(createServiceError(message))
          }

          let decoded = decode(NotificationSchema, value, INVALID_NOTIFICATION_RESPONSE)
          if (decoded.status === 'ok') {
            return Result.ok(toNotificationResponse(decoded.value))
          }

          // The body doesn't match any known shape, but the queue can only
          // move forward by receiptId. Hand the poller a deletable stub so
          // one unknown item can't wedge the whole queue.
          let receiptOnly = decode(ReceiptIdOnlySchema, value, INVALID_NOTIFICATION_RESPONSE)
          if (receiptOnly.status === 'ok') {
            return Result.ok({
              receiptId: receiptOnly.value.receiptId,
              undecodable: true as const,
            })
          }

          return Result.err(receiptOnly.error)
        }
      )
    })
  }

  async sendMessage(
    body: SendMessageBody
  ): Promise<ResultType<SendMessageResponse, GreenApiError>> {
    return this.#requestJson(
      this.#endpoints.sendMessage,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      },
      (value) =>
        decode(
          SendMessageResponseSchema,
          value,
          'GREEN-API returned an invalid SendMessage response'
        )
    )
  }

  async #requestJson<T>(
    url: string,
    init: RequestInit,
    decodeJson: (value: unknown) => ResultType<T, GreenApiError>,
    timeoutMs?: number
  ): Promise<ResultType<T, GreenApiError>> {
    let textResult = await this.#requestText(
      url,
      init,
      [],
      timeoutMs ?? this.#requestTimeoutMs
    )

    return textResult.andThen((text) => {
      if (!text.trim()) {
        return Result.err(createInvalidResponseError('GREEN-API returned an empty response'))
      }

      return parseJson(text, 'GREEN-API returned malformed JSON').andThen(decodeJson)
    })
  }

  async #requestText(
    url: string,
    init: RequestInit,
    acceptedStatuses: readonly number[] = [],
    timeoutMs?: number
  ): Promise<ResultType<string, GreenApiError>> {
    let effectiveTimeout = timeoutMs ?? this.#requestTimeoutMs
    let requestSignal: AbortSignal | undefined

    return Result.tryPromise({
      try: async () => {
        let signal = combineWithTimeout(init.signal, effectiveTimeout)
        requestSignal = signal
        // Fetcher is injectable, so keep a promise-level guard for adapters
        // that do not honor the abort signal.
        let response = await raceWithTimeout(
          this.#fetcher(url, { ...init, signal }),
          effectiveTimeout
        )

        if (!response.ok && !acceptedStatuses.includes(response.status)) {
          let reason = await readResponseReason(response)
          let statusMessage =
            `GREEN-API request failed with ${response.status} ${response.statusText}`.trim()

          throw new GreenApiError({
            kind: 'http',
            message: reason ? `${statusMessage}: ${reason}` : statusMessage,
            reason,
            retryable: isRetryableStatus(response.status),
            status: response.status,
          })
        }

        return response.text()
      },
      catch: (cause) => toGreenApiError(cause, requestSignal),
    })
  }

  #getEndpointBase(endpoint: ApiEndpoint): string {
    let idInstance = encodeURIComponent(this.#idInstance)
    let apiTokenInstance = encodeURIComponent(this.#apiTokenInstance)

    return `${this.#apiUrl}/waInstance${idInstance}/${endpoint}/${apiTokenInstance}`
  }
}

function combineWithTimeout(
  signal: AbortSignal | undefined | null,
  timeoutMs: number
): AbortSignal {
  let timeoutSignal = AbortSignal.timeout(timeoutMs)
  if (!signal) return timeoutSignal
  return AbortSignal.any([signal, timeoutSignal])
}

function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new DOMException('The operation timed out.', 'TimeoutError'))
    }, timeoutMs)
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
      ;(timer as { unref: () => void }).unref?.()
    }
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

async function readResponseReason(response: Response): Promise<string | null> {
  let text = await response.text()
  if (!text.trim()) return null

  try {
    let value: unknown = JSON.parse(text)
    if (isRecord(value)) {
      if (typeof value.reason === 'string' && value.reason.trim()) {
        return value.reason.trim()
      }
      if (typeof value.message === 'string' && value.message.trim()) {
        return value.message.trim()
      }
    }
  } catch {
    // Fall through to plain-text handling below.
  }

  return text.trim().slice(0, 200)
}

function parseJson(text: string, message: string): ResultType<unknown, GreenApiError> {
  return Result.try({
    try: () => JSON.parse(text) as unknown,
    catch: () => createInvalidResponseError(message),
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorName(cause: unknown): string | null {
  if (typeof cause !== 'object' || cause === null || !('name' in cause)) return null

  let name = (cause as { name?: unknown }).name
  return typeof name === 'string' ? name : null
}

function toGreenApiError(cause: unknown, signal?: AbortSignal): GreenApiError {
  if (GreenApiError.is(cause)) return cause

  if (signal?.aborted) {
    return errorName(signal.reason) === 'TimeoutError'
      ? createTimeoutError()
      : createCancelledError()
  }

  let name = errorName(cause)
  if (name === 'TimeoutError') return createTimeoutError()
  if (name === 'AbortError') return createCancelledError()
  if (name === 'NetworkError' || cause instanceof TypeError) return createNetworkError()

  // Unknown exceptions are defects, not transport failures. Let better-result
  // turn them into a Panic instead of disguising them as retryable errors.
  throw cause
}
