import { useLocation } from 'wouter'

import type { GreenApi } from '#/api'

import { AuthStore } from '../modules/auth/store'
import { JoinForm, type JoinFormResult } from '../modules/chat/join'
import { resolveRecipient } from '../modules/chat/resolve-recipient'
import { routePaths } from '../routes/paths'

interface JoinPageProps {
  api: GreenApi | null
}

export function JoinPage({ api }: JoinPageProps) {
  let [, navigate] = useLocation()

  async function handleSubmit(phoneNumber: number): Promise<JoinFormResult> {
    let result = await resolveRecipient(api, phoneNumber)
    if (result.kind === 'error') return result

    console.log('[chat] checkAccount', JSON.stringify({ phoneNumber, chatId: result.chatId }))
    navigate(routePaths.chat(result.chatId))
    return { kind: 'success' }
  }

  return (
    <JoinForm
      onSubmit={handleSubmit}
      onChangeCredentials={() => {
        AuthStore.actions.clear()
        navigate(routePaths.login, { replace: true })
      }}
    />
  )
}
