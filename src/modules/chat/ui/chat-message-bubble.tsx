import type { ChatMessage } from '../transcript'

import styles from './chat-message-bubble.module.css'

interface ChatMessageBubbleProps {
  message: ChatMessage
  isFirstInGroup: boolean
  isLastInGroup: boolean
  onRetry: () => void
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ChatMessageBubble({
  message,
  isFirstInGroup,
  isLastInGroup,
  onRetry,
}: ChatMessageBubbleProps) {
  let time = formatTime(message.timestamp)
  let status = message.status ?? 'sent'

  return (
    <div>
      <div
        className={styles.Bubble}
        data-variant={message.direction}
        data-status={status}
        data-first={isFirstInGroup || undefined}
        data-last={isLastInGroup || undefined}
      >
        <div className={styles.BubbleContent}>
          <div className={styles.MessageText} data-meta={time}>
            {message.text}
          </div>
          {message.direction === 'outgoing' && status === 'failed' ? (
            <button type='button' className={styles.RetryButton} onClick={onRetry}>
              Not sent — retry
            </button>
          ) : null}
          <div className={styles.Time}>{time}</div>
        </div>
      </div>
    </div>
  )
}
