import { Api } from './client'
import type { GreenApi, GreenApiOptions } from './interface'

export function createGreenApi(options: GreenApiOptions): GreenApi {
  return new Api(options)
}

export { GreenApiError, describeApiError, type GreenApiErrorKind } from './errors'
export { parseApiUrlInput } from './api-url'

export type {
  CheckAccountBody,
  CheckAccountResult,
  DeleteNotificationResult,
  Fetcher,
  GreenApi,
  GreenApiOptions,
  ReceiveNotificationResponse,
  ReceiveNotificationResult,
  SendMessageBody,
  SendMessageResponse,
  StateInstanceResponse,
  UndecodableNotification,
} from './interface'
