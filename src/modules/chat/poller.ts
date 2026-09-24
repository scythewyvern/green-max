import { useEffect } from 'react'

import type {
  DeleteNotificationResult,
  GreenApi,
  GreenApiError,
  ReceiveNotificationResponse,
  ReceiveNotificationResult,
  UndecodableNotification,
} from '#/api'

import type { ChatSession } from './store'
import { messageFromNotification, type ChatMessage } from './transcript'

export interface NotificationTransport {
  receive: (signal: AbortSignal) => Promise<ReceiveNotificationResult>
  acknowledge: (receiptId: number, signal: AbortSignal) => Promise<DeleteNotificationResult>
}

export interface NotificationSession {
  addMessage: (chatId: string, message: ChatMessage) => void
  setContactName: (chatId: string, name: string) => void
  setPollError: (error: GreenApiError | null) => void
}

interface PollOnceOptions {
  transport: NotificationTransport
  session: NotificationSession
  signal: AbortSignal
}

type PollOnceResult =
  | { kind: 'idle' }
  | { kind: 'cancelled' }
  | {
      kind: 'processed'
      chatId: string | null
      message: ChatMessage | null
      contactName: string | null
    }
  | { kind: 'error'; error: GreenApiError }

type WaitForRetry = (delay: number, signal: AbortSignal) => Promise<void>

interface RunNotificationPollOptions {
  transport: NotificationTransport
  session: NotificationSession
  signal: AbortSignal
  wait?: WaitForRetry
}

export function createApiNotificationTransport(api: GreenApi): NotificationTransport {
  return {
    receive: (signal) => api.receiveNotification(signal),
    acknowledge: (receiptId, signal) => api.deleteNotification(receiptId, signal),
  }
}

export function createChatSessionSink(session: ChatSession): NotificationSession {
  return {
    addMessage: (chatId, message) => session.actions.addMessage(chatId, message),
    setContactName: (chatId, name) => session.actions.setContactName(chatId, name),
    setPollError: (error) => session.actions.setPollError(error),
  }
}

export async function pollNotificationOnce({
  transport,
  session,
  signal,
}: PollOnceOptions): Promise<PollOnceResult> {
  let received = await transport.receive(signal)
  if (signal.aborted) return { kind: 'cancelled' }

  if (received.status === 'error') {
    return { kind: 'error', error: received.error }
  }

  let notification = received.value
  if (!notification) return { kind: 'idle' }

  return processNotification({ notification, transport, session, signal })
}

interface ProcessNotificationOptions {
  notification: ReceiveNotificationResponse | UndecodableNotification
  transport: NotificationTransport
  session: NotificationSession
  signal: AbortSignal
}

async function processNotification({
  notification,
  transport,
  session,
  signal,
}: ProcessNotificationOptions): Promise<PollOnceResult> {
  logNotification(notification)

  if ('undecodable' in notification) {
    console.warn(
      `[chat] skipping undecodable notification (receiptId ${notification.receiptId}); deleting to keep the queue moving.`
    )
    return acknowledgeNotification(transport, notification.receiptId, signal)
  }

  let routed = messageFromNotification(notification)
  if (routed) {
    session.addMessage(routed.chatId, routed.message)
    console.log(
      '[chat] stored',
      JSON.stringify({ chatId: routed.chatId, id: routed.message.id })
    )
  } else {
    console.log(
      '[chat] ignored',
      JSON.stringify({
        typeWebhook: notification.body.typeWebhook,
        typeMessage: notification.body.messageData?.typeMessage,
        chatId: notification.body.senderData?.chatId,
      })
    )
  }

  let senderChatId = notification.body.senderData?.chatId ?? null
  let contactName = notification.body.senderData?.chatName ?? null
  if (senderChatId && contactName) {
    session.setContactName(senderChatId, contactName)
  }

  let acknowledgement = await acknowledgeNotification(
    transport,
    notification.receiptId,
    signal
  )
  if (acknowledgement.kind !== 'processed') return acknowledgement

  return {
    ...acknowledgement,
    chatId: routed?.chatId ?? senderChatId,
    message: routed?.message ?? null,
    contactName,
  }
}

async function acknowledgeNotification(
  transport: NotificationTransport,
  receiptId: number,
  signal: AbortSignal
): Promise<PollOnceResult> {
  if (signal.aborted) return { kind: 'cancelled' }

  let deletion = await transport.acknowledge(receiptId, signal)
  if (deletion.status === 'error') {
    return { kind: 'error', error: deletion.error }
  }

  return { kind: 'processed', chatId: null, message: null, contactName: null }
}

const INITIAL_RETRY_DELAY_MS = 1_000
const MAX_RETRY_DELAY_MS = 30_000

export async function runNotificationPoll({
  transport,
  session,
  signal,
  wait = waitForRetry,
}: RunNotificationPollOptions): Promise<void> {
  let retryDelay = INITIAL_RETRY_DELAY_MS

  while (!signal.aborted) {
    let result = await pollNotificationOnce({ transport, session, signal })
    if (signal.aborted) return

    if (result.kind === 'cancelled') return

    if (result.kind === 'idle') {
      session.setPollError(null)
      retryDelay = INITIAL_RETRY_DELAY_MS
      continue
    }

    if (result.kind === 'error') {
      if (result.error.kind === 'cancelled') return

      session.setPollError(result.error)
      console.error(result.error)
      if (!result.error.retryable) return

      await wait(retryDelay, signal)
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
      continue
    }

    session.setPollError(null)
    retryDelay = INITIAL_RETRY_DELAY_MS
  }
}

export function startNotificationPoll({
  transport,
  session,
  wait,
}: {
  transport: NotificationTransport
  session: NotificationSession
  wait?: WaitForRetry
}): () => void {
  let controller = new AbortController()

  void runNotificationPoll({
    transport,
    session,
    signal: controller.signal,
    wait,
  })

  return () => controller.abort()
}

export function useNotificationPoll({
  api,
  session,
}: {
  api: GreenApi
  session: ChatSession
}): void {
  useEffect(() => {
    return startNotificationPoll({
      transport: createApiNotificationTransport(api),
      session: createChatSessionSink(session),
    })
  }, [api, session])
}

function logNotification(
  notification: ReceiveNotificationResponse | UndecodableNotification
): void {
  if ('undecodable' in notification) {
    console.log('[chat] received', JSON.stringify({ receiptId: notification.receiptId }))
    return
  }

  console.log(
    '[chat] received',
    JSON.stringify({
      receiptId: notification.receiptId,
      typeWebhook: notification.body.typeWebhook,
      typeMessage: notification.body.messageData?.typeMessage,
      chatId: notification.body.senderData?.chatId,
    })
  )
}

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()

  return new Promise((resolve) => {
    let timeout = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, delay)

    function handleAbort() {
      clearTimeout(timeout)
      resolve()
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}
