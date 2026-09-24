import { describe, expect, spyOn, test } from 'bun:test'

import { Result } from 'better-result'

import type { GreenApi } from '#/api'
import {
  acknowledgementResponse,
  createTestApi,
  makeGreenApiError,
  queuedFetcher,
} from '#/test-support/api'

import {
  createApiNotificationTransport,
  createChatSessionSink,
  pollNotificationOnce,
  runNotificationPoll,
  startNotificationPoll,
  type NotificationSession,
  type NotificationTransport,
} from './poller'
import { createChatSession, type ChatSession } from './store'

function pollOnce(api: GreenApi, session: ChatSession, signal = new AbortController().signal) {
  return pollNotificationOnce({
    transport: createApiNotificationTransport(api),
    session: createChatSessionSink(session),
    signal,
  })
}

function incomingTextNotification(
  receiptId: number,
  chatId: string,
  id: string,
  text: string
) {
  return {
    receiptId,
    body: {
      typeWebhook: 'incomingMessageReceived',
      idMessage: id,
      timestamp: 1763115112,
      senderData: { chatId, chatName: 'Recipient' },
      messageData: {
        typeMessage: 'textMessage',
        textMessageData: { textMessage: text },
      },
    },
  }
}

describe('notification intake', () => {
  test('processes and acknowledges one incoming text notification', async () => {
    let chatId = 'chat-poller-success'
    let session = createChatSession()
    let responses = [
      Response.json({
        receiptId: 42,
        body: {
          typeWebhook: 'incomingMessageReceived',
          idMessage: `message-42-${chatId}`,
          timestamp: 1763115112,
          senderData: { chatId, chatName: 'Recipient' },
          messageData: {
            typeMessage: 'textMessage',
            textMessageData: { textMessage: 'Hello' },
          },
        },
      }),
      acknowledgementResponse(),
    ]
    let api = createTestApi({
      fetcher: queuedFetcher(responses),
    })

    let result = await pollOnce(api, session)

    expect(result.kind).toBe('processed')
    if (result.kind === 'processed') {
      expect(result.chatId).toBe(chatId)
      expect(result.message?.text).toBe('Hello')
      expect(result.contactName).toBe('Recipient')
    }
    expect(session.state.messagesByChatId[chatId]?.at(-1)?.text).toBe('Hello')
    expect(session.state.contactNames[chatId]).toBe('Recipient')
    expect(responses).toHaveLength(0)
  })

  test('routes messages for chat B while chat A is open without loss', async () => {
    let chatA = 'chat-a'
    let chatB = 'chat-b'
    let session = createChatSession()
    let responses = [
      Response.json({
        receiptId: 99,
        body: {
          typeWebhook: 'incomingMessageReceived',
          idMessage: `message-b-1-${chatB}`,
          timestamp: 1763115112,
          senderData: { chatId: chatB, chatName: 'B' },
          messageData: {
            typeMessage: 'textMessage',
            textMessageData: { textMessage: 'Hello B' },
          },
        },
      }),
      acknowledgementResponse(),
    ]
    let api = createTestApi({
      fetcher: queuedFetcher(responses),
    })

    let result = await pollOnce(api, session)

    expect(result.kind).toBe('processed')
    // Chat A stays untouched, chat B receives the message: opening B later shows it.
    expect(session.state.messagesByChatId[chatA] ?? []).toHaveLength(0)
    expect(session.state.messagesByChatId[chatB]?.map((m) => m.text)).toContain('Hello B')
    expect(responses).toHaveLength(0)
  })

  test('treats JSON null as an idle poll without acknowledging anything', async () => {
    let session = createChatSession()
    let requests = 0
    let api = createTestApi({
      fetcher: async () => {
        requests += 1
        return Response.json(null)
      },
    })

    let result = await pollOnce(api, session)

    expect(result.kind).toBe('idle')
    expect(requests).toBe(1)
  })

  test('does not acknowledge a documented receive error envelope', async () => {
    let session = createChatSession()
    let requests = 0
    let api = createTestApi({
      fetcher: async () => {
        requests += 1
        return Response.json({
          code: 'INVALID_PARAM',
          message: 'Message cannot be received because custom webhook url is set.',
          status: 'error',
        })
      },
    })

    let result = await pollOnce(api, session)

    expect(result.kind).toBe('error')
    expect(requests).toBe(1)
  })

  test('deletes and skips undecodable items so the queue keeps moving', async () => {
    let session = createChatSession()
    let responses = [
      Response.json({
        receiptId: 777,
        body: {
          typeWebhook: 'someFutureMessageType',
          messageData: 'not-an-object-in-this-future-format',
        },
      }),
      acknowledgementResponse(),
    ]
    let api = createTestApi({
      fetcher: queuedFetcher(responses),
    })

    let result = await pollOnce(api, session)

    expect(result.kind).toBe('processed')
    if (result.kind === 'processed') {
      expect(result.message).toBeNull()
    }
    expect(responses).toHaveLength(0)
  })

  test('acknowledges non-text notifications without storing them', async () => {
    let chatId = 'chat-poller-image'
    let session = createChatSession()
    let responses = [
      Response.json({
        receiptId: 79,
        body: {
          typeWebhook: 'incomingMessageReceived',
          idMessage: 'image-message',
          timestamp: 1763115112,
          senderData: { chatId, chatName: 'Recipient' },
          messageData: {
            typeMessage: 'imageMessage',
            imageMessageData: { caption: 'Photo' },
          },
        },
      }),
      acknowledgementResponse(),
    ]
    let api = createTestApi({
      fetcher: queuedFetcher(responses),
    })

    let result = await pollOnce(api, session)

    expect(result.kind).toBe('processed')
    if (result.kind === 'processed') {
      expect(result.message).toBeNull()
    }
    expect(session.state.messagesByChatId[chatId]).toBeUndefined()
    expect(responses).toHaveLength(0)
  })

  test('routes link messages sent as extended text', async () => {
    let chatId = 'chat-poller-extended'
    let session = createChatSession()
    let responses = [
      Response.json({
        receiptId: 78,
        body: {
          typeWebhook: 'incomingMessageReceived',
          idMessage: `message-78-${chatId}`,
          timestamp: 1763115112,
          senderData: { chatId, chatName: 'Recipient' },
          messageData: {
            typeMessage: 'extendedTextMessage',
            extendedTextMessageData: { text: 'See https://green-api.com/' },
          },
        },
      }),
      acknowledgementResponse(),
    ]
    let api = createTestApi({
      fetcher: queuedFetcher(responses),
    })

    let result = await pollOnce(api, session)

    expect(result.kind).toBe('processed')
    expect(session.state.messagesByChatId[chatId]?.at(-1)?.text).toBe(
      'See https://green-api.com/'
    )
    expect(responses).toHaveLength(0)
  })

  test('keeps a late notification inside its originating session', async () => {
    let chatId = 'chat-late-poll'
    let resolveNotification!: () => void
    let notificationResponse = new Promise<Response>((resolve) => {
      resolveNotification = () =>
        resolve(
          Response.json({
            receiptId: 91,
            body: {
              typeWebhook: 'incomingMessageReceived',
              idMessage: 'late-notification-message',
              timestamp: 1763115112,
              senderData: { chatId, chatName: 'Recipient' },
              messageData: {
                typeMessage: 'textMessage',
                textMessageData: { textMessage: 'Old account message' },
              },
            },
          })
        )
    })
    let requests = 0
    let api = createTestApi({
      fetcher: async () => {
        requests += 1
        return requests === 1 ? notificationResponse : acknowledgementResponse()
      },
    })
    let originalSession = createChatSession()
    let currentSession = createChatSession()

    let request = pollOnce(api, originalSession)
    resolveNotification()
    await request

    expect(originalSession.state.messagesByChatId[chatId]?.at(-1)?.text).toBe(
      'Old account message'
    )
    expect(currentSession.state.messagesByChatId[chatId]).toBeUndefined()
  })

  test('processes and acknowledges queued notifications in FIFO order', async () => {
    let chatId = 'chat-fifo'
    let cancelledError = makeGreenApiError({ kind: 'cancelled', message: 'cancelled' })
    let receiptIds = [201, 202, 203]
    let results: Array<Awaited<ReturnType<NotificationTransport['receive']>>> = [
      Result.ok(incomingTextNotification(201, chatId, 'fifo-1', 'First')),
      Result.ok(incomingTextNotification(202, chatId, 'fifo-2', 'Second')),
      Result.err(cancelledError),
    ]
    let events: string[] = []
    let transport: NotificationTransport = {
      receive: async () => {
        let receiptId = receiptIds.shift()
        events.push(`receive-${receiptId}`)
        return results.shift() ?? Result.err(cancelledError)
      },
      acknowledge: async (receiptId) => {
        events.push(`ack-${receiptId}`)
        return Result.ok(undefined)
      },
    }
    let session = createChatSession()
    let sink = createChatSessionSink(session)

    await runNotificationPoll({
      transport,
      session: sink,
      signal: new AbortController().signal,
    })

    expect(events).toEqual(['receive-201', 'ack-201', 'receive-202', 'ack-202', 'receive-203'])
    expect(session.state.messagesByChatId[chatId]?.map((message) => message.text)).toEqual([
      'First',
      'Second',
    ])
  })

  test('backs off from one second to the thirty-second cap', async () => {
    let controller = new AbortController()
    let delays: number[] = []
    let networkError = makeGreenApiError()
    let transport: NotificationTransport = {
      receive: async () => Result.err(networkError),
      acknowledge: async () => Result.ok(undefined),
    }
    let session: NotificationSession = {
      addMessage: () => {},
      setContactName: () => {},
      setPollError: () => {},
    }
    let errorSpy = spyOn(console, 'error').mockImplementation(() => {})

    try {
      await runNotificationPoll({
        transport,
        session,
        signal: controller.signal,
        wait: async (delay) => {
          delays.push(delay)
          if (delays.length === 6) controller.abort()
        },
      })

      expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000])
    } finally {
      errorSpy.mockRestore()
    }
  })

  test('stops after a non-retryable poll error', async () => {
    let attempts = 0
    let waits = 0
    let serviceError = makeGreenApiError({
      kind: 'service',
      message: 'custom webhook is configured',
      reason: 'custom webhook is configured',
    })
    let transport: NotificationTransport = {
      receive: async () => {
        attempts += 1
        return Result.err(serviceError)
      },
      acknowledge: async () => Result.ok(undefined),
    }
    let session: NotificationSession = {
      addMessage: () => {},
      setContactName: () => {},
      setPollError: () => {},
    }
    let errorSpy = spyOn(console, 'error').mockImplementation(() => {})

    try {
      await runNotificationPoll({
        transport,
        session,
        signal: new AbortController().signal,
        wait: async () => {
          waits += 1
        },
      })

      expect(attempts).toBe(1)
      expect(waits).toBe(0)
    } finally {
      errorSpy.mockRestore()
    }
  })

  test('does not store or acknowledge a notification after cancellation', async () => {
    let controller = new AbortController()
    let acknowledged = false
    let chatId = 'chat-cancelled-poll'
    let transport: NotificationTransport = {
      receive: async () => {
        controller.abort()
        return Result.ok({
          receiptId: 101,
          body: {
            typeWebhook: 'incomingMessageReceived',
            idMessage: 'cancelled-message',
            timestamp: 1763115112,
            senderData: { chatId, chatName: 'Recipient' },
            messageData: {
              typeMessage: 'textMessage',
              textMessageData: { textMessage: 'Should not be stored' },
            },
          },
        })
      },
      acknowledge: async () => {
        acknowledged = true
        return Result.ok(undefined)
      },
    }
    let session = createChatSession()
    let sink = createChatSessionSink(session)

    await runNotificationPoll({
      transport,
      session: sink,
      signal: controller.signal,
    })

    expect(session.state.messagesByChatId[chatId]).toBeUndefined()
    expect(acknowledged).toBe(false)
  })

  test('stops one lifecycle run and allows a clean remount', async () => {
    let cancelledError = makeGreenApiError({ kind: 'cancelled', message: 'cancelled' })
    let firstStarted!: (signal: AbortSignal) => void
    let firstSignal = new Promise<AbortSignal>((resolve) => {
      firstStarted = resolve
    })
    let finishFirst!: () => void
    let firstTransport: NotificationTransport = {
      receive: (signal) => {
        firstStarted(signal)
        return new Promise((resolve) => {
          finishFirst = () => resolve(Result.err(cancelledError))
        })
      },
      acknowledge: async () => Result.ok(undefined),
    }
    let session: NotificationSession = {
      addMessage: () => {},
      setContactName: () => {},
      setPollError: () => {},
    }

    let stopFirst = startNotificationPoll({ transport: firstTransport, session })
    let firstRunSignal = await firstSignal
    stopFirst()
    expect(firstRunSignal.aborted).toBe(true)
    finishFirst()

    let secondStarted!: () => void
    let secondStart = new Promise<void>((resolve) => {
      secondStarted = resolve
    })
    let secondTransport: NotificationTransport = {
      receive: async () => {
        secondStarted()
        return Result.err(cancelledError)
      },
      acknowledge: async () => Result.ok(undefined),
    }
    let stopSecond = startNotificationPoll({ transport: secondTransport, session })
    await secondStart
    stopSecond()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  test('resets backoff after a successful poll', async () => {
    let controller = new AbortController()
    let delays: number[] = []
    let networkError = makeGreenApiError()
    let results: Array<Awaited<ReturnType<NotificationTransport['receive']>>> = [
      Result.err(networkError),
      Result.err(networkError),
      Result.ok(null),
      Result.err(networkError),
    ]
    let transport: NotificationTransport = {
      receive: async () => results.shift() ?? Result.ok(null),
      acknowledge: async () => Result.ok(undefined),
    }
    let session: NotificationSession = {
      addMessage: () => {},
      setContactName: () => {},
      setPollError: () => {},
    }
    let errorSpy = spyOn(console, 'error').mockImplementation(() => {})

    try {
      await runNotificationPoll({
        transport,
        session,
        signal: controller.signal,
        wait: async (delay) => {
          delays.push(delay)
          if (delays.length === 3) controller.abort()
        },
      })

      expect(delays).toEqual([1_000, 2_000, 1_000])
    } finally {
      errorSpy.mockRestore()
    }
  })
})
