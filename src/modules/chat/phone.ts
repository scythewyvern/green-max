import { Result, TaggedError, type Result as ResultType } from 'better-result'

export class InvalidPhoneNumber extends TaggedError('InvalidPhoneNumber')<{
  input: string
  message: string
}> {}

const PHONE_MESSAGE = 'Enter an international phone number with 7–15 digits.'

function invalidPhoneNumber(input: string): InvalidPhoneNumber {
  return new InvalidPhoneNumber({
    input: input.trim(),
    message: PHONE_MESSAGE,
  })
}

export function parsePhoneNumber(input: string): ResultType<number, InvalidPhoneNumber> {
  let normalized = input
    .trim()
    .replace(/[\s()-]/g, '')
    .replace(/^(?:\+|00)/, '')

  if (!/^\d{7,15}$/.test(normalized)) {
    return Result.err(invalidPhoneNumber(input))
  }

  let value = Number(normalized)
  if (!Number.isSafeInteger(value)) {
    return Result.err(invalidPhoneNumber(input))
  }

  return Result.ok(value)
}
