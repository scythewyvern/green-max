import styles from './chat-header.module.css'

interface ChatHeaderProps {
  name: string
  statusMessage?: string | null
  onBack: () => void
}

export function ChatHeader({ name, statusMessage, onBack }: ChatHeaderProps) {
  return (
    <header className={styles.Header}>
      <button
        type='button'
        className={styles.BackButton}
        onClick={onBack}
        aria-label='Back to new chat'
      >
        <svg
          aria-hidden='true'
          xmlns='http://www.w3.org/2000/svg'
          fill='none'
          viewBox='0 0 24 24'
          width={20}
          height={20}
        >
          <path
            fill='currentColor'
            fillRule='evenodd'
            d='M14.7 5.3a1 1 0 0 0-1.4 1.4l4.3 4.3H6a1 1 0 1 0 0 2h11.6l-4.3 4.3a1 1 0 1 0 1.4 1.4l6-6a1 1 0 0 0 0-1.4l-6-6Z'
            clipRule='evenodd'
            transform='rotate(180 12 12)'
          />
        </svg>
      </button>
      <div className={styles.Avatar} aria-hidden='true' />
      <div className={styles.TitleWrapper}>
        <div className={styles.Name}>{name}</div>
        {statusMessage ? (
          <p className={styles.ConnectionStatus} role='status' title={statusMessage}>
            {statusMessage}
          </p>
        ) : null}
      </div>
    </header>
  )
}
