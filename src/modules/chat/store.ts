import { createStore, useSelector } from '@tanstack/react-store'

import type { GreenApiError } from '#/api'

import {
  appendUniqueMessage,
  replaceMessage,
  updateMessageStatus,
  type ChatMessage,
  type MessageStatus,
} from './transcript'

const EMPTY_MESSAGES: ChatMessage[] = []

interface ChatSessionState {
  messagesByChatId: Record<string, ChatMessage[]>
  contactNames: Record<string, string>
  pollError: GreenApiError | null
}

type ChatSessionActions = {
  addMessage: (chatId: string, message: ChatMessage) => void
  replaceMessage: (chatId: string, tempId: string, message: ChatMessage) => void
  setMessageStatus: (chatId: string, id: string, status: MessageStatus) => void
  setContactName: (chatId: string, name: string) => void
  setPollError: (error: GreenApiError | null) => void
}

function updateMessagesForChat(
  state: ChatSessionState,
  chatId: string,
  update: (messages: ChatMessage[]) => ChatMessage[]
): ChatSessionState {
  let current = state.messagesByChatId[chatId] ?? EMPTY_MESSAGES
  let next = update(current)
  if (next === current) return state

  return {
    ...state,
    messagesByChatId: {
      ...state.messagesByChatId,
      [chatId]: next,
    },
  }
}

export function createChatSession() {
  return createStore<ChatSessionState, ChatSessionActions>(
    {
      messagesByChatId: {},
      contactNames: {},
      pollError: null,
    },
    ({ setState }) => ({
      addMessage: (chatId, message) => {
        setState((prev) =>
          updateMessagesForChat(prev, chatId, (messages) =>
            appendUniqueMessage(messages, message)
          )
        )
      },
      replaceMessage: (chatId, tempId, message) => {
        setState((prev) =>
          updateMessagesForChat(prev, chatId, (messages) =>
            replaceMessage(messages, tempId, message)
          )
        )
      },
      setMessageStatus: (chatId, id, status) => {
        setState((prev) =>
          updateMessagesForChat(prev, chatId, (messages) =>
            updateMessageStatus(messages, id, status)
          )
        )
      },
      setContactName: (chatId, name) => {
        setState((prev) => {
          if (prev.contactNames[chatId] === name) return prev
          return {
            ...prev,
            contactNames: { ...prev.contactNames, [chatId]: name },
          }
        })
      },
      setPollError: (error) => {
        setState((prev) => {
          if (prev.pollError === error) return prev
          return { ...prev, pollError: error }
        })
      },
    })
  )
}

export type ChatSession = ReturnType<typeof createChatSession>

export function useChatMessages(session: ChatSession, chatId: string): ChatMessage[] {
  return useSelector(session, (state) => state.messagesByChatId[chatId] ?? EMPTY_MESSAGES)
}

export function useContactName(session: ChatSession, chatId: string): string | null {
  return useSelector(session, (state) => state.contactNames[chatId] ?? null)
}

export function usePollError(session: ChatSession): GreenApiError | null {
  return useSelector(session, (state) => state.pollError)
}
