import { describeApiError, type GreenApi, type GreenApiError } from '#/api'
import { MaxBackground } from '#/ui/max-background'

import { retryMessage, sendMessage } from './outgoing-messages'
import { useChatMessages, useContactName, usePollError, type ChatSession } from './store'
import { ChatHeader } from './ui/chat-header'
import { ChatInput } from './ui/chat-input'
import { ChatMessageList } from './ui/chat-message-list'
import { useStickToBottom } from './use-stick-to-bottom'

import styles from './view.module.css'

function formatPollError(error: GreenApiError): string {
  if (error.kind === 'network') return 'Reconnecting to GREEN-API…'
  return describeApiError(error)
}

export function ChatView({
  api,
  session,
  chatId,
  onBack,
}: {
  api: GreenApi
  session: ChatSession
  chatId: string
  onBack: () => void
}) {
  let messages = useChatMessages(session, chatId)
  let contactName = useContactName(session, chatId)
  let pollError = usePollError(session)

  let viewportRef = useStickToBottom(messages)

  return (
    <div className={styles.Root}>
      <ChatHeader
        name={contactName ?? chatId}
        statusMessage={pollError ? formatPollError(pollError) : null}
        onBack={onBack}
      />
      <MaxBackground />
      <div className={styles.History}>
        <div className={styles.HistoryInner}>
          <div className={styles.Cropped}>
            <ChatMessageList
              messages={messages}
              viewportRef={viewportRef}
              onRetry={(message) => {
                void retryMessage({ api, session, chatId, message })
              }}
            />
          </div>

          <ChatInput onSubmit={(text) => sendMessage({ api, session, chatId, text })} />
        </div>
      </div>
    </div>
  )
}
