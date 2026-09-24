import { useId, useRef, useState } from 'react'
import TextareaAutosize from 'react-textarea-autosize'

import { shouldSubmitOnEnter, submitComposerInput } from '../composer'
import { MAX_MESSAGE_LENGTH, type SendMessageCommandResult } from '../outgoing-messages'

import styles from './chat-input.module.css'

interface ChatInputProps {
  onSubmit: (message: string) => SendMessageCommandResult
}

export function ChatInput({ onSubmit }: ChatInputProps) {
  let messageId = useId()
  let [text, setText] = useState('')
  let formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    let nextText: string
    try {
      nextText = submitComposerInput(text, onSubmit)
    } catch (error) {
      console.error(error)
      return
    }

    if (nextText !== text) setText(nextText)
  }

  return (
    <div className={styles.Composer}>
      <form ref={formRef} className={styles.Form} noValidate onSubmit={handleSubmit}>
        <div className={styles.Field}>
          <label className={styles.SrOnly} htmlFor={messageId}>
            Message
          </label>
          <TextareaAutosize
            id={messageId}
            minRows={1}
            maxRows={10}
            maxLength={MAX_MESSAGE_LENGTH}
            className={styles.TextArea}
            placeholder='Message…'
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (
                shouldSubmitOnEnter({
                  key: event.key,
                  shiftKey: event.shiftKey,
                  isComposing: event.nativeEvent.isComposing,
                })
              ) {
                event.preventDefault()
                formRef.current?.requestSubmit()
              }
            }}
          />
        </div>
        <button className={styles.SendButton} type='submit' aria-label='Send message'>
          <svg
            aria-hidden='true'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            width={24}
            height={24}
          >
            <path
              fill='currentColor'
              fillRule='evenodd'
              d='M5.29 11.705a1 1 0 0 1 .005-1.415l6.015-5.97a1 1 0 0 1 1.41.001l5.987 5.972a1 1 0 0 1-1.412 1.416l-4.28-4.27v11.533a1 1 0 1 1-2 0V7.43l-4.31 4.279a1 1 0 0 1-1.414-.005'
              clipRule='evenodd'
            />
          </svg>
        </button>
      </form>
    </div>
  )
}
