import { describe, expect, spyOn, test } from 'bun:test'

import type { GreenApi } from '#/api'
import { createTestApi } from '#/test-support/api'

import { MAX_MESSAGE_LENGTH, retryMessage, sendMessage } from './outgoing-messages'
import { createChatSession } from './store'
import type { ChatMessage } from './transcript'

function createMessageApi(respond: () => Response | Promise<Response>): GreenApi {
  return createTestApi({
    fetcher: async () => respond(),
  })
}

async function waitForAcceptedMessage(result: ReturnType<typeof sendMessage>): Promise<void> {
  expect(result.kind).toBe('accepted')
  if (result.kind !== 'accepted') throw new Error('expected accepted message')
  await result.completion
}

describe('outgoing messages', () => {
  test('rejects messages over the command length limit before creating a bubble', () => {
    let chatId = 'chat-send-too-long'
    let api = createMessageApi(() => Response.json({ idMessage: 'unexpected' }))
    let session = createChatSession()

    let result = sendMessage({
      api,
      session,
      chatId,
      text: 'x'.repeat(MAX_MESSAGE_LENGTH + 1),
    })

    expect(result).toEqual({ kind: 'rejected', reason: 'too-long' })
    expect(session.state.messagesByChatId[chatId]).toBeUndefined()
  })

  test('rejects whitespace-only commands before creating a bubble', () => {
    let chatId = 'chat-send-empty'
    let api = createMessageApi(() => Response.json({ idMessage: 'unexpected' }))
    let session = createChatSession()

    expect(sendMessage({ api, session, chatId, text: ' \n\t ' })).toEqual({
      kind: 'rejected',
      reason: 'empty',
    })
    expect(session.state.messagesByChatId[chatId]).toBeUndefined()
  })

  test('adds a sending message immediately and reconciles a successful send', async () => {
    let chatId = 'chat-send-success'
    let api = createMessageApi(() => Response.json({ idMessage: 'confirmed-message' }))
    let session = createChatSession()

    let result = sendMessage({ api, session, chatId, text: 'Hello' })
    let optimistic = session.state.messagesByChatId[chatId]?.at(-1)

    expect(optimistic?.text).toBe('Hello')
    expect(optimistic?.direction).toBe('outgoing')
    expect(optimistic?.status).toBe('sending')
    expect(optimistic?.id.startsWith('local-')).toBe(true)
    let optimisticTimestamp = optimistic?.timestamp

    await waitForAcceptedMessage(result)

    let messages = session.state.messagesByChatId[chatId] ?? []
    expect(messages).toHaveLength(1)
    expect(messages[0]?.id).toBe('confirmed-message')
    expect(messages[0]?.status).toBe('sent')
    expect(messages[0]?.timestamp).toBe(optimisticTimestamp)
  })

  test('accepts separate submissions with identical text', async () => {
    let chatId = 'chat-repeat-submit'
    let responses = [
      Response.json({ idMessage: 'confirmed-1' }),
      Response.json({ idMessage: 'confirmed-2' }),
    ]
    let api = createMessageApi(() => {
      let response = responses.shift()
      if (!response) throw new Error('unexpected request')
      return response
    })
    let session = createChatSession()

    let first = sendMessage({ api, session, chatId, text: 'Again' })
    let second = sendMessage({ api, session, chatId, text: 'Again' })

    expect(first.kind).toBe('accepted')
    expect(second.kind).toBe('accepted')
    expect(session.state.messagesByChatId[chatId]?.map((message) => message.status)).toEqual([
      'sending',
      'sending',
    ])
    if (first.kind !== 'accepted' || second.kind !== 'accepted') {
      throw new Error('expected both submissions to be accepted')
    }
    await Promise.all([first.completion, second.completion])

    expect(session.state.messagesByChatId[chatId]?.map((message) => message.id)).toEqual([
      'confirmed-1',
      'confirmed-2',
    ])
  })

  test('marks the optimistic message as failed when sending fails', async () => {
    let chatId = 'chat-send-failure'
    let api = createMessageApi(
      () => new Response('server error', { status: 503, statusText: 'Unavailable' })
    )
    let session = createChatSession()
    let errorSpy = spyOn(console, 'error').mockImplementation(() => {})

    try {
      let result = sendMessage({ api, session, chatId, text: 'Hello' })
      await waitForAcceptedMessage(result)

      let message = session.state.messagesByChatId[chatId]?.at(-1)
      expect(message?.status).toBe('failed')
      expect(message?.id.startsWith('local-')).toBe(true)
    } finally {
      errorSpy.mockRestore()
    }
  })

  test('retries a failed message and reconciles the confirmed message', async () => {
    let chatId = 'chat-retry-success'
    let session = createChatSession()
    let failedMessage: ChatMessage = {
      id: 'local-failed-message',
      text: 'Try again',
      direction: 'outgoing',
      timestamp: Date.now() / 1000,
      status: 'failed',
    }
    let api = createMessageApi(() => Response.json({ idMessage: 'retried-message' }))
    session.actions.addMessage(chatId, failedMessage)

    let request = retryMessage({ api, session, chatId, message: failedMessage })
    expect(session.state.messagesByChatId[chatId]?.at(-1)?.status).toBe('sending')

    await request

    let messages = session.state.messagesByChatId[chatId] ?? []
    expect(messages).toHaveLength(1)
    expect(messages[0]?.id).toBe('retried-message')
    expect(messages[0]?.text).toBe('Try again')
    expect(messages[0]?.status).toBe('sent')
  })

  test('keeps a late send result inside its originating session', async () => {
    let chatId = 'chat-late-send'
    let resolveResponse!: () => void
    let response = new Promise<Response>((resolve) => {
      resolveResponse = () => resolve(Response.json({ idMessage: 'late-confirmed-message' }))
    })
    let api = createMessageApi(() => response)
    let originalSession = createChatSession()
    let currentSession = createChatSession()
    let currentMessage: ChatMessage = {
      id: 'current-session-message',
      text: 'Current account',
      direction: 'incoming',
      timestamp: 1,
      status: 'sent',
    }
    currentSession.actions.addMessage('current-chat', currentMessage)

    let result = sendMessage({ api, session: originalSession, chatId, text: 'Old account' })
    resolveResponse()
    await waitForAcceptedMessage(result)

    expect(originalSession.state.messagesByChatId[chatId]?.at(-1)?.id).toBe(
      'late-confirmed-message'
    )
    expect(currentSession.state.messagesByChatId['current-chat']).toEqual([currentMessage])
    expect(currentSession.state.messagesByChatId[chatId]).toBeUndefined()
  })
})
