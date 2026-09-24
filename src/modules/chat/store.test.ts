import { describe, expect, test } from 'bun:test'

import { makeGreenApiError } from '#/test-support/api'

import { createChatSession } from './store'
import type { ChatMessage } from './transcript'

describe('chat sessions', () => {
  test('isolates chat state between sessions', () => {
    let first = createChatSession()
    let second = createChatSession()
    let message: ChatMessage = {
      id: 'message-1',
      text: 'Private message',
      direction: 'outgoing',
      timestamp: 1,
      status: 'sent',
    }

    let pollError = makeGreenApiError()

    first.actions.addMessage('chat-1', message)
    first.actions.setContactName('chat-1', 'Recipient')
    first.actions.setPollError(pollError)

    expect(first.state.messagesByChatId['chat-1']).toEqual([message])
    expect(first.state.contactNames['chat-1']).toBe('Recipient')
    expect(first.state.pollError).toBe(pollError)
    expect(second.state.messagesByChatId['chat-1']).toBeUndefined()
    expect(second.state.contactNames['chat-1']).toBeUndefined()
    expect(second.state.pollError).toBeNull()
  })
})
