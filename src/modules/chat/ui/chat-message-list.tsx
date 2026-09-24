import type { RefObject } from 'react'

import { ScrollArea } from '#/ui/scroll-area'

import type { ChatMessage } from '../transcript'
import { ChatMessageBubble } from './chat-message-bubble'

import styles from './chat-message-list.module.css'

interface ChatMessageListProps {
  messages: ChatMessage[]
  viewportRef: RefObject<HTMLDivElement | null>
  onRetry: (message: ChatMessage) => void
}

export function ChatMessageList({ messages, viewportRef, onRetry }: ChatMessageListProps) {
  return (
    <ScrollArea viewportRef={viewportRef} style={{ height: '100%' }}>
      <div
        className={styles.Messages}
        role='log'
        aria-live='polite'
        aria-relevant='additions'
        aria-label='Chat messages'
      >
        {messages.length === 0 ? (
          <p className={styles.EmptyState}>
            No messages yet. Send a message to start the conversation.
          </p>
        ) : null}
        {messages.map((message, index) => {
          let previous = messages[index - 1]
          let next = messages[index + 1]
          let isFirstInGroup = !previous || previous.direction !== message.direction
          let isLastInGroup = !next || next.direction !== message.direction

          return (
            <ChatMessageBubble
              key={message.id}
              message={message}
              isFirstInGroup={isFirstInGroup}
              isLastInGroup={isLastInGroup}
              onRetry={() => onRetry(message)}
            />
          )
        })}
      </div>
    </ScrollArea>
  )
}
