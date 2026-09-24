import { Redirect, useLocation } from 'wouter'

import type { ChatRuntime } from '../app-runtime'
import { ChatView } from '../modules/chat/view'
import { routePaths } from '../routes/paths'

interface ChatPageProps {
  runtime: ChatRuntime | null
  chatId: string | undefined
}

export function ChatPage({ runtime, chatId }: ChatPageProps) {
  let [, navigate] = useLocation()

  if (!runtime || !chatId) return <Redirect to={routePaths.join} replace />

  return (
    <ChatView
      key={chatId}
      api={runtime.api}
      session={runtime.session}
      chatId={chatId}
      onBack={() => navigate(routePaths.join)}
    />
  )
}
