import { useId, useState } from 'react'

import { env } from '#/env'
import { EntryScreen } from '#/ui/entry-screen'

import { parseCredentials } from './credentials'
import { AuthStore } from './store'
import { verifyCredentials, type CredentialApiFactory } from './verify-credentials'

import formStyles from '#/ui/entry-form.module.css'

interface LoginFormProps {
  createApi: CredentialApiFactory
  onSuccess: () => void
}

export function LoginForm({ createApi, onSuccess }: LoginFormProps) {
  let errorId = useId()
  let idInstanceId = useId()
  let apiTokenInstanceId = useId()
  let apiUrlId = useId()
  let [error, setError] = useState<string | null>(null)
  let [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <EntryScreen
      title='Connect to MAX'
      description='Enter the credentials for your authorized GREEN-API instance.'
      error={error}
      errorId={errorId}
      footer='Your credentials are stored only in this browser.'
    >
      <form
        className={formStyles.Form}
        noValidate
        onSubmit={async (event) => {
          event.preventDefault()
          setError(null)

          let formData = new FormData(event.currentTarget)
          let result = parseCredentials(
            formData.get(idInstanceId),
            formData.get(apiTokenInstanceId),
            formData.get(apiUrlId)
          )

          if (result.status === 'error') {
            setError(result.error.message)
            return
          }

          let credentials = result.value
          setIsSubmitting(true)

          try {
            let result = await verifyCredentials(credentials, createApi)
            if (result.kind === 'error') {
              setError(result.message)
              return
            }

            AuthStore.actions.setCredentials(credentials)
            onSuccess()
          } catch {
            setError('Unable to verify these credentials. Try again.')
          } finally {
            setIsSubmitting(false)
          }
        }}
      >
        <div className={formStyles.Field}>
          <label className={formStyles.Label} htmlFor={idInstanceId}>
            Instance ID
          </label>
          <input
            className={formStyles.Input}
            id={idInstanceId}
            name={idInstanceId}
            type='text'
            inputMode='numeric'
            autoComplete='username'
            aria-describedby={error ? errorId : undefined}
            placeholder='1100000000'
            required
          />
        </div>

        <div className={formStyles.Field}>
          <label className={formStyles.Label} htmlFor={apiTokenInstanceId}>
            API token
          </label>
          <input
            className={formStyles.Input}
            id={apiTokenInstanceId}
            name={apiTokenInstanceId}
            type='password'
            autoComplete='current-password'
            aria-describedby={error ? errorId : undefined}
            required
          />
        </div>

        <div className={formStyles.Field}>
          <label className={formStyles.Label} htmlFor={apiUrlId}>
            API URL
          </label>
          <input
            className={formStyles.Input}
            id={apiUrlId}
            name={apiUrlId}
            type='url'
            inputMode='url'
            autoComplete='url'
            aria-describedby={error ? errorId : undefined}
            defaultValue={env.API_URL}
            placeholder='https://1103.api.green-api.com'
            required
          />
        </div>

        <button
          className={formStyles.Primary}
          type='submit'
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </EntryScreen>
  )
}
