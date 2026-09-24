import type { ReceiveNotificationResponse } from '#/api'

export interface ChatMessage {
  id: string
  text: string
  direction: 'incoming' | 'outgoing'
  timestamp: number
  status?: MessageStatus
}

export type MessageStatus = 'sending' | 'sent' | 'failed'

export interface RoutedMessage {
  chatId: string
  message: ChatMessage
}

export function messageFromNotification(
  notification: ReceiveNotificationResponse,
  now = Date.now() / 1000
): RoutedMessage | null {
  let { body } = notification
  let { messageData, senderData } = body

  if (
    body.typeWebhook !== 'incomingMessageReceived' &&
    body.typeWebhook !== 'outgoingMessageReceived' &&
    body.typeWebhook !== 'outgoingAPIMessageReceived'
  ) {
    return null
  }

  let chatId = senderData?.chatId
  if (!body.idMessage || !chatId) return null
  if (
    messageData?.typeMessage !== 'textMessage' &&
    messageData?.typeMessage !== 'extendedTextMessage'
  ) {
    return null
  }

  let text =
    messageData.textMessageData?.textMessage ?? messageData.extendedTextMessageData?.text
  if (typeof text !== 'string') return null

  return {
    chatId,
    message: {
      id: body.idMessage,
      text,
      direction: body.typeWebhook === 'incomingMessageReceived' ? 'incoming' : 'outgoing',
      timestamp: body.timestamp ?? now,
    },
  }
}

export function appendUniqueMessage(
  messages: ChatMessage[],
  message: ChatMessage
): ChatMessage[] {
  return messages.some((item) => item.id === message.id) ? messages : [...messages, message]
}

export function replaceMessage(
  messages: ChatMessage[],
  tempId: string,
  message: ChatMessage
): ChatMessage[] {
  let replaced = false
  let next: ChatMessage[] = []

  for (let item of messages) {
    if (item.id === tempId) {
      next.push(message)
      replaced = true
      continue
    }
    // A racing outgoing echo may already carry the confirmed id. Drop it so
    // the confirmed message appears exactly once.
    if (item.id === message.id) continue
    next.push(item)
  }

  return replaced ? next : appendUniqueMessage(messages, message)
}

export function updateMessageStatus(
  messages: ChatMessage[],
  id: string,
  status: MessageStatus
): ChatMessage[] {
  return messages.map((item) => (item.id === id ? { ...item, status } : item))
}

export function makeTempId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
