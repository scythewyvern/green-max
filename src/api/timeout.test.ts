import { describe, expect, test } from 'bun:test'

import { Panic } from 'better-result'

import { createTestApi } from '#/test-support/api'

import { GreenApiError } from './index'

describe('Api request timeout', () => {
  test('a never-resolving fetcher returns a retryable network error', async () => {
    let api = createTestApi({
      requestTimeoutMs: 30,
      fetcher: () => new Promise<Response>(() => {}),
    })

    let result = await api.sendMessage({ chatId: 'chat-7', message: 'Hello' })

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('network')
      expect(result.error.retryable).toBe(true)
    }
  })

  test('maps TimeoutError to network and AbortError to cancelled', async () => {
    let timeoutApi = createTestApi({
      requestTimeoutMs: 20,
      fetcher: async () => {
        throw new DOMException('The operation timed out.', 'TimeoutError')
      },
    })

    let timeoutResult = await timeoutApi.sendMessage({ chatId: 'chat-7', message: 'Hi' })
    expect(timeoutResult.status).toBe('error')
    if (timeoutResult.status === 'error' && GreenApiError.is(timeoutResult.error)) {
      expect(timeoutResult.error.kind).toBe('network')
    }

    let abortApi = createTestApi({
      fetcher: async () => {
        throw new DOMException('The operation was aborted.', 'AbortError')
      },
    })

    let abortResult = await abortApi.sendMessage({ chatId: 'chat-7', message: 'Hi' })
    expect(abortResult.status).toBe('error')
    if (abortResult.status === 'error' && GreenApiError.is(abortResult.error)) {
      expect(abortResult.error.kind).toBe('cancelled')
    }
  })

  test('keeps timeout-induced AbortErrors classified as retryable network failures', async () => {
    let api = createTestApi({
      requestTimeoutMs: 20,
      fetcher: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('The operation was aborted.', 'AbortError')),
            { once: true }
          )
        }),
    })

    let result = await api.sendMessage({ chatId: 'chat-7', message: 'Hello' })

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('network')
      expect(result.error.retryable).toBe(true)
    }
  })

  test('caller cancellation reaches the fetcher and is classified as cancelled', async () => {
    let controller = new AbortController()
    let api = createTestApi({
      fetcher: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          })
        }),
    })

    let request = api.receiveNotification(controller.signal)
    controller.abort('caller stopped')
    let result = await request

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('cancelled')
    }
  })

  test('does not disguise unexpected fetcher defects as network failures', async () => {
    let api = createTestApi({
      fetcher: async () => {
        throw new Error('fetcher invariant broke')
      },
    })

    let thrown: unknown
    try {
      await api.sendMessage({ chatId: 'chat-7', message: 'Hello' })
    } catch (error) {
      thrown = error
    }

    expect(Panic.is(thrown)).toBe(true)
  })
})
