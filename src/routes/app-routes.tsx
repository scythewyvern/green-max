import { Redirect, Route, Switch } from 'wouter'

import { createApiForCredentials, type ChatRuntime } from '../app-runtime'
import { ChatPage } from '../pages/chat-page'
import { JoinPage } from '../pages/join-page'
import { LoginPage } from '../pages/login-page'
import { routePaths } from './paths'

interface AppRoutesProps {
  runtime: ChatRuntime | null
  isAuthenticated: boolean
}

export function AppRoutes({ runtime, isAuthenticated }: AppRoutesProps) {
  return (
    <Switch>
      <Route path={routePaths.login}>
        {isAuthenticated ? (
          <Redirect to={routePaths.join} replace />
        ) : (
          <LoginPage createApi={createApiForCredentials} />
        )}
      </Route>

      <Route path={routePaths.join}>
        {isAuthenticated ? (
          <JoinPage api={runtime?.api ?? null} />
        ) : (
          <Redirect to={routePaths.login} replace />
        )}
      </Route>

      <Route path={routePaths.chatPattern}>
        {(params) =>
          isAuthenticated ? (
            <ChatPage runtime={runtime} chatId={params.chatId} />
          ) : (
            <Redirect to={routePaths.login} replace />
          )
        }
      </Route>

      <Route>
        <Redirect to={isAuthenticated ? routePaths.join : routePaths.login} replace />
      </Route>
    </Switch>
  )
}
