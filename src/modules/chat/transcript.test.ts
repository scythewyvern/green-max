import { describe, expect, test } from 'bun:test'

import type { ReceiveNotificationResponse } from '#/api'

import {
  appendUniqueMessage,
  messageFromNotification,
  replaceMessage,
  updateMessageStatus,
} from './transcript'

const INCOMING: ReceiveNotificationResponse = {
  receiptId: 1,
  body: {
    typeWebhook: 'incomingMessageReceived',
    idMessage: 'message-1',
    timestamp: 1763115112,
    senderData: { chatId: 'chat-7', chatName: 'Recipient' },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: 'Hello' },
    },
  },
}

describe('messageFromNotification', () => {
  test('maps an incoming text notification into a routed transcript message', () => {
    let result = messageFromNotification(INCOMING)

    expect(result).toEqual({
      chatId: 'chat-7',
      message: {
        id: 'message-1',
        text: 'Hello',
        direction: 'incoming',
        timestamp: 1763115112,
      },
    })
  })

  test('routes messages from any chat instead of filtering', () => {
    let other = {
      ...INCOMING,
      body: {
        ...INCOMING.body,
        senderData: { chatId: 'another-chat', chatName: 'Other' },
      },
    }

    let result = messageFromNotification(other)

    expect(result?.chatId).toBe('another-chat')
    expect(result?.message.text).toBe('Hello')
  })

  test('ignores non-text webhooks', () => {
    let result = messageFromNotification({
      receiptId: 2,
      body: { typeWebhook: 'outgoingMessageStatus', idMessage: 'x' },
    })

    expect(result).toBeNull()
  })

  test('reads link messages sent as extended text', () => {
    let result = messageFromNotification({
      receiptId: 3,
      body: {
        typeWebhook: 'incomingMessageReceived',
        idMessage: 'message-3',
        timestamp: 1763115112,
        senderData: { chatId: 'chat-7', chatName: 'Recipient' },
        messageData: {
          typeMessage: 'extendedTextMessage',
          extendedTextMessageData: { text: 'See https://green-api.com/' },
        },
      },
    })

    expect(result).toEqual({
      chatId: 'chat-7',
      message: {
        id: 'message-3',
        text: 'See https://green-api.com/',
        direction: 'incoming',
        timestamp: 1763115112,
      },
    })
  })

  test('still ignores media and other non-text types', () => {
    let result = messageFromNotification({
      receiptId: 4,
      body: {
        typeWebhook: 'incomingMessageReceived',
        idMessage: 'message-4',
        timestamp: 1763115112,
        senderData: { chatId: 'chat-7' },
        messageData: { typeMessage: 'imageMessage' },
      },
    })

    expect(result).toBeNull()
  })
})

describe('appendUniqueMessage', () => {
  test('does not add the same message id twice', () => {
    let routed = messageFromNotification(INCOMING)
    if (!routed) throw new Error('fixture should produce a message')

    let first = appendUniqueMessage([], routed.message)
    let second = appendUniqueMessage(first, routed.message)

    expect(first).toHaveLength(1)
    expect(second).toBe(first)
  })
})

describe('replaceMessage', () => {
  test('swaps a temp message for its confirmed version', () => {
    let temp = { id: 'local-1', text: 'Hi', direction: 'outgoing' as const, timestamp: 1 }
    let confirmed = { id: 'srv-1', text: 'Hi', direction: 'outgoing' as const, timestamp: 2 }

    let next = replaceMessage([temp], 'local-1', confirmed)

    expect(next).toHaveLength(1)
    expect(next[0]).toEqual(confirmed)
  })

  test('absorbs a racing outgoing echo with the confirmed id', () => {
    let temp = { id: 'local-1', text: 'Hi', direction: 'outgoing' as const, timestamp: 1 }
    let echo = { id: 'srv-1', text: 'Hi', direction: 'outgoing' as const, timestamp: 2 }
    let confirmed = { id: 'srv-1', text: 'Hi', direction: 'outgoing' as const, timestamp: 3 }

    let next = replaceMessage([temp, echo], 'local-1', confirmed)

    expect(next).toHaveLength(1)
    expect(next[0]).toEqual(confirmed)
  })

  test('appends when the temp message is gone', () => {
    let confirmed = { id: 'srv-1', text: 'Hi', direction: 'outgoing' as const, timestamp: 2 }

    let next = replaceMessage([], 'local-missing', confirmed)

    expect(next).toEqual([confirmed])
  })
})

describe('updateMessageStatus', () => {
  test('marks one message without touching the rest', () => {
    let first = { id: 'a', text: 'Hi', direction: 'outgoing' as const, timestamp: 1 }
    let second = { id: 'b', text: 'Yo', direction: 'outgoing' as const, timestamp: 2 }

    let next = updateMessageStatus([first, second], 'a', 'failed')

    expect(next[0]).toEqual({ ...first, status: 'failed' })
    expect(next[1]).toBe(second)
  })
})
