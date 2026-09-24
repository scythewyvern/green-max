import { Result, TaggedError, type Result as ResultType } from 'better-result'

import { parseApiUrlInput } from '#/api'

export interface Credentials {
  idInstance: string
  apiTokenInstance: string
  apiUrl: string
}

export type StoredCredentials = Credentials

export class InvalidCredentials extends TaggedError('InvalidCredentials')<{
  message: string
}> {}

function normalizeRequiredText(input: unknown): string | null {
  if (typeof input !== 'string') return null

  let normalized = input.trim()
  return normalized || null
}

export function parseCredentials(
  idInstance: FormDataEntryValue | null,
  apiTokenInstance: FormDataEntryValue | null,
  apiUrl: FormDataEntryValue | null
): ResultType<Credentials, InvalidCredentials> {
  let normalizedId = normalizeRequiredText(idInstance)
  if (normalizedId === null) {
    return Result.err(new InvalidCredentials({ message: 'Enter your instance ID.' }))
  }

  let normalizedToken = normalizeRequiredText(apiTokenInstance)
  if (normalizedToken === null) {
    return Result.err(new InvalidCredentials({ message: 'Enter your API token.' }))
  }

  let parsedUrl = parseApiUrlInput(apiUrl)
  if (!parsedUrl) {
    return Result.err(
      new InvalidCredentials({ message: 'API URL must use HTTPS, except for loopback HTTP.' })
    )
  }

  return Result.ok({
    idInstance: normalizedId,
    apiTokenInstance: normalizedToken,
    apiUrl: parsedUrl,
  })
}

export function parseStoredCredentials(input: unknown): StoredCredentials | null {
  if (typeof input !== 'object' || input === null) return null

  let record = input as Record<string, unknown>
  let idInstance = normalizeRequiredText(record.idInstance)
  let apiTokenInstance = normalizeRequiredText(record.apiTokenInstance)
  let apiUrl = parseApiUrlInput(record.apiUrl)

  if (idInstance === null || apiTokenInstance === null || apiUrl === null) return null

  return { idInstance, apiTokenInstance, apiUrl }
}
