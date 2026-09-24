import { describe, expect, test } from 'bun:test'

import { InvalidPhoneNumber, parsePhoneNumber } from './phone'

describe('parsePhoneNumber', () => {
  test('normalizes a formatted international number with a plus sign', () => {
    let result = parsePhoneNumber(' +44 (20) 7946-0958 ')

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toBe(442079460958)
    }
  })

  test('accepts the 00 international prefix', () => {
    let result = parsePhoneNumber('00 1 415 555 2671')

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toBe(14155552671)
    }
  })

  test('accepts seven-digit numbers', () => {
    let result = parsePhoneNumber('1234567')

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toBe(1234567)
    }
  })

  test('rejects numbers outside the supported international length', () => {
    for (let input of ['123456', '1234567890123456', 'not-a-phone-number']) {
      let result = parsePhoneNumber(input)

      expect(result.status).toBe('error')
      if (result.status === 'error' && InvalidPhoneNumber.is(result.error)) {
        expect(result.error.input).toBe(input)
      }
    }
  })
})
