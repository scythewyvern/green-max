import type { SendMessageCommandResult } from './outgoing-messages'

export function parseComposerInput(value: string): string | null {
  if (!value.trim()) return null
  return value
}

export function submitComposerInput(
  value: string,
  onSubmit: (message: string) => SendMessageCommandResult
): string {
  let payload = parseComposerInput(value)
  if (payload === null) return value

  let result = onSubmit(payload)
  return result.kind === 'accepted' ? '' : value
}

export function shouldSubmitOnEnter({
  key,
  shiftKey,
  isComposing,
}: {
  key: string
  shiftKey: boolean
  isComposing: boolean
}): boolean {
  return key === 'Enter' && !shiftKey && !isComposing
}
