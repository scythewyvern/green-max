import { createGreenApi, type GreenApi } from './api'
import type { StoredCredentials } from './modules/auth/credentials'
import { createChatSession, type ChatSession } from './modules/chat/store'

export interface ChatRuntime {
  api: GreenApi
  session: ChatSession
}

export function createApiForCredentials(credentials: StoredCredentials): GreenApi {
  return createGreenApi({
    apiUrl: credentials.apiUrl,
    idInstance: credentials.idInstance,
    apiTokenInstance: credentials.apiTokenInstance,
  })
}

export function createChatRuntime(credentials: StoredCredentials | null): ChatRuntime | null {
  if (!credentials) return null

  return {
    api: createApiForCredentials(credentials),
    session: createChatSession(),
  }
}
