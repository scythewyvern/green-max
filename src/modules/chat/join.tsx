import { useId, useState } from 'react'

import { EntryScreen } from '#/ui/entry-screen'

import { parsePhoneNumber } from './phone'

import formStyles from '#/ui/entry-form.module.css'

export type JoinFormResult = { kind: 'success' } | { kind: 'error'; message: string }

interface JoinFormProps {
  onSubmit: (phoneNumber: number) => Promise<JoinFormResult>
  onChangeCredentials: () => void
}

export function JoinForm({ onSubmit, onChangeCredentials }: JoinFormProps) {
  let errorId = useId()
  let fieldId = useId()
  let hintId = useId()
  let [error, setError] = useState<string | null>(null)
  let [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <EntryScreen
      title='Start a chat'
      description='Enter an international phone number to find a MAX recipient.'
      error={error}
      errorId={errorId}
      footer={
        <button className={formStyles.LinkButton} type='button' onClick={onChangeCredentials}>
          Change credentials
        </button>
      }
    >
      <form
        className={formStyles.Form}
        noValidate
        onSubmit={async (event) => {
          event.preventDefault()
          setError(null)

          let formData = new FormData(event.currentTarget)
          let input = formData.get(fieldId)
          if (typeof input !== 'string') {
            setError('Enter a phone number.')
            return
          }

          let parsed = parsePhoneNumber(input)
          if (parsed.status === 'error') {
            setError(parsed.error.message)
            return
          }

          setIsSubmitting(true)
          let result: JoinFormResult
          try {
            result = await onSubmit(parsed.value)
          } catch {
            result = { kind: 'error', message: 'Unable to check this number. Try again.' }
          }
          setIsSubmitting(false)

          if (result.kind === 'error') {
            setError(result.message)
          }
        }}
      >
        <div className={formStyles.Field}>
          <label className={formStyles.Label} htmlFor={fieldId}>
            Phone number
          </label>
          <input
            className={formStyles.Input}
            id={fieldId}
            name={fieldId}
            type='tel'
            inputMode='tel'
            autoComplete='tel'
            placeholder='7 999 123-45-67'
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            required
          />
          <p className={formStyles.Helper} id={hintId}>
            Use 7–15 digits, including the country code. A leading + is optional.
          </p>
        </div>

        <button
          className={formStyles.Primary}
          type='submit'
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Checking…' : 'Create chat'}
        </button>
      </form>
    </EntryScreen>
  )
}
