import { createStore, useSelector } from '@tanstack/react-store'

import type { Credentials, StoredCredentials } from './credentials'
import { clearApiCredentials, loadApiCredentials, persistApiCredentials } from './persist'

interface AuthStoreValue {
  credentials: StoredCredentials | null
}

type AuthStoreActions = {
  setCredentials: (credentials: Credentials) => void
  clear: () => void
}

function initialCredentials(): StoredCredentials | null {
  try {
    return loadApiCredentials()
  } catch {
    return null
  }
}

export let AuthStore = createStore<AuthStoreValue, AuthStoreActions>(
  {
    credentials: initialCredentials(),
  },
  ({ setState }) => ({
    setCredentials: (credentials) => {
      persistApiCredentials(credentials)
      setState((prev) => ({
        ...prev,
        credentials,
      }))
    },
    clear: () => {
      clearApiCredentials()
      setState((prev) => ({
        ...prev,
        credentials: null,
      }))
    },
  })
)

export function useAuth() {
  let credentials = useSelector(AuthStore, (state) => state.credentials)

  return {
    credentials,
    isAuthenticated: credentials !== null,
  }
}
