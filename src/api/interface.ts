import type { Result as ResultType } from 'better-result'

import type { GreenApiError } from './errors'

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface GreenApiOptions {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
  receiveTimeout?: number
  requestTimeoutMs?: number
  fetcher?: Fetcher
}

export interface CheckAccountBody {
  phoneNumber: number
  force?: boolean
}

export type CheckAccountResult =
  | {
      kind: 'found'
      chatId: string
      fromCache?: boolean
    }
  | {
      kind: 'not_found'
      fromCache?: boolean
    }

export interface SendMessageBody {
  chatId: string
  message: string
  typingTime?: number
  quotedMessageId?: string
}

export interface SendMessageResponse {
  idMessage: string
}

export interface StateInstanceResponse {
  stateInstance: string
}

export interface ReceiveNotificationResponse {
  receiptId: number
  body: {
    typeWebhook?: string
    idMessage?: string
    timestamp?: number
    senderData?: {
      chatId?: string
      chatName?: string
    }
    messageData?: {
      typeMessage?: string
      textMessageData?: {
        textMessage?: string
      }
      extendedTextMessageData?: {
        text?: string
      }
    }
  }
}

export interface UndecodableNotification {
  receiptId: number
  undecodable: true
}

export type ReceiveNotificationResult = ResultType<
  ReceiveNotificationResponse | UndecodableNotification | null,
  GreenApiError
>

export type DeleteNotificationResult = ResultType<void, GreenApiError>

export interface GreenApi {
  checkAccount: (
    body: CheckAccountBody
  ) => Promise<ResultType<CheckAccountResult, GreenApiError>>
  getStateInstance: () => Promise<ResultType<StateInstanceResponse, GreenApiError>>
  sendMessage: (
    body: SendMessageBody
  ) => Promise<ResultType<SendMessageResponse, GreenApiError>>
  receiveNotification: (signal?: AbortSignal) => Promise<ReceiveNotificationResult>
  deleteNotification: (
    receiptId: number,
    signal?: AbortSignal
  ) => Promise<DeleteNotificationResult>
}
