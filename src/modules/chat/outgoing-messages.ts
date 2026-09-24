import type { GreenApi } from '#/api'

import type { ChatSession } from './store'
import { makeTempId, type ChatMessage } from './transcript'

export const MAX_MESSAGE_LENGTH = 4_000

export type SendMessageCommandResult =
  | { kind: 'accepted'; messageId: string; completion: Promise<void> }
  | { kind: 'rejected'; reason: 'empty' | 'too-long' }

interface SendMessageOptions {
  api: GreenApi
  session: ChatSession
  chatId: string
  text: string
}

interface RetryMessageOptions {
  api: GreenApi
  session: ChatSession
  chatId: string
  message: ChatMessage
}

interface ReconcileMessageOptions {
  api: GreenApi
  session: ChatSession
  chatId: string
  message: ChatMessage
}

export function sendMessage({
  api,
  session,
  chatId,
  text,
}: SendMessageOptions): SendMessageCommandResult {
  if (!text.trim()) return { kind: 'rejected', reason: 'empty' }
  if (text.length > MAX_MESSAGE_LENGTH) return { kind: 'rejected', reason: 'too-long' }

  let message: ChatMessage = {
    id: makeTempId(),
    text,
    direction: 'outgoing',
    timestamp: Date.now() / 1000,
    status: 'sending',
  }

  session.actions.addMessage(chatId, message)
  let completion = reconcileMessage({ api, session, chatId, message })

  return { kind: 'accepted', messageId: message.id, completion }
}

export function retryMessage({
  api,
  session,
  chatId,
  message,
}: RetryMessageOptions): Promise<void> {
  session.actions.setMessageStatus(chatId, message.id, 'sending')
  return reconcileMessage({ api, session, chatId, message })
}

async function reconcileMessage({
  api,
  session,
  chatId,
  message,
}: ReconcileMessageOptions): Promise<void> {
  try {
    let result = await api.sendMessage({ chatId, message: message.text })

    result.match({
      ok: ({ idMessage }) => {
        session.actions.replaceMessage(chatId, message.id, {
          ...message,
          id: idMessage,
          status: 'sent',
        })
      },
      err: (error) => markMessageFailed(session, chatId, message, error),
    })
  } catch (error) {
    // Delivery is a user-visible command; keep the bubble retryable even if
    // the transport adapter throws outside its Result contract.
    markMessageFailed(session, chatId, message, error)
  }
}

function markMessageFailed(
  session: ChatSession,
  chatId: string,
  message: ChatMessage,
  error: unknown
): void {
  console.error(error)
  session.actions.setMessageStatus(chatId, message.id, 'failed')
}
