import { describe, expect, test } from 'bun:test'

import { routePaths } from './paths'

describe('route paths', () => {
  test('keeps static route paths canonical', () => {
    expect(routePaths.login).toBe('/login')
    expect(routePaths.join).toBe('/join')
    expect(routePaths.chatPattern).toBe('/chat/:chatId')
  })

  test('encodes chat ids in concrete paths', () => {
    expect(routePaths.chat('100/abc')).toBe('/chat/100%2Fabc')
  })
})
