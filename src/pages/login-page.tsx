import { useLocation } from 'wouter'

import { LoginForm } from '../modules/auth/login'
import type { CredentialApiFactory } from '../modules/auth/verify-credentials'
import { routePaths } from '../routes/paths'

interface LoginPageProps {
  createApi: CredentialApiFactory
}

export function LoginPage({ createApi }: LoginPageProps) {
  let [, navigate] = useLocation()

  return <LoginForm createApi={createApi} onSuccess={() => navigate(routePaths.join)} />
}
