import styles from './max-background.module.css'

export function MaxBackground() {
  return (
    <div className={styles.Root} aria-hidden='true'>
      <div className={styles.Layer} />
      <div className={`${styles.Layer} ${styles.Additional}`} />
      <div className={`${styles.Layer} ${styles.Pattern}`} />
    </div>
  )
}
