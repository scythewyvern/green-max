import { useMemo } from 'react'

import { createChatRuntime, type ChatRuntime } from './app-runtime'
import { useAuth } from './modules/auth/store'
import { useNotificationPoll } from './modules/chat/poller'
import { AppRoutes } from './routes/app-routes'

import styles from './app.module.css'

function AuthenticatedPoller({ runtime }: { runtime: ChatRuntime }) {
  useNotificationPoll(runtime)
  return null
}

export function App() {
  let { credentials, isAuthenticated } = useAuth()
  let runtime = useMemo(() => createChatRuntime(credentials), [credentials])

  return (
    <div className={styles.App}>
      {runtime ? <AuthenticatedPoller runtime={runtime} /> : null}
      <AppRoutes runtime={runtime} isAuthenticated={isAuthenticated} />
    </div>
  )
}
