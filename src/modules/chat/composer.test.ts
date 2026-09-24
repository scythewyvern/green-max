import { describe, expect, test } from 'bun:test'

import { parseComposerInput, shouldSubmitOnEnter, submitComposerInput } from './composer'

const accepted = {
  kind: 'accepted' as const,
  messageId: 'message-1',
  completion: Promise.resolve(),
}

describe('composer policy', () => {
  test('clears the draft after local acceptance', () => {
    expect(submitComposerInput('Hello', () => accepted)).toBe('')
  })

  test('retains the draft after command rejection', () => {
    expect(
      submitComposerInput('Hello', () => ({ kind: 'rejected', reason: 'too-long' }))
    ).toBe('Hello')
  })

  test('does not submit whitespace-only input', () => {
    let calls = 0

    expect(
      submitComposerInput('  \n', () => {
        calls += 1
        return accepted
      })
    ).toBe('  \n')
    expect(calls).toBe(0)
  })

  test('submits plain Enter but preserves newline and IME composition', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter', shiftKey: false, isComposing: false })).toBe(
      true
    )
    expect(shouldSubmitOnEnter({ key: 'Enter', shiftKey: true, isComposing: false })).toBe(
      false
    )
    expect(shouldSubmitOnEnter({ key: 'Enter', shiftKey: false, isComposing: true })).toBe(
      false
    )
    expect(shouldSubmitOnEnter({ key: 'a', shiftKey: false, isComposing: false })).toBe(false)
  })

  test('preserves surrounding whitespace in accepted text', () => {
    expect(parseComposerInput('  hello  ')).toBe('  hello  ')
  })
})
