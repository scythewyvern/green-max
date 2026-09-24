import { useId, type ReactNode } from 'react'

import { MaxBackground } from './max-background'

import styles from './entry-screen.module.css'

interface EntryScreenProps {
  title: string
  description: string
  children: ReactNode
  error?: string | null
  errorId: string
  footer?: ReactNode
}

export function EntryScreen({
  title,
  description,
  children,
  error,
  errorId,
  footer,
}: EntryScreenProps) {
  let titleId = useId()
  let descriptionId = useId()

  return (
    <main className={styles.Main} aria-labelledby={titleId} aria-describedby={descriptionId}>
      <MaxBackground />
      <section className={styles.Card}>
        <header className={styles.Header}>
          <span className={styles.Eyebrow}>GREEN-API · MAX</span>
          <h1 id={titleId}>{title}</h1>
          <p id={descriptionId}>{description}</p>
        </header>

        {children}

        {error ? (
          <p id={errorId} className={styles.Error} role='alert'>
            {error}
          </p>
        ) : null}

        {footer ? <div className={styles.Footer}>{footer}</div> : null}
      </section>
    </main>
  )
}
