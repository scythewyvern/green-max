import { Result, type Result as ResultType } from 'better-result'
import * as v from 'valibot'

import { createInvalidResponseError, GreenApiError } from './errors'
import type { CheckAccountResult, ReceiveNotificationResponse } from './interface'

const nonEmptyString = v.pipe(v.string(), v.minLength(1))

// The live API sometimes sends ids, names, and texts as JSON numbers
// (e.g. `"chatId": 10000000`). Coerce them to strings instead of failing.
const StringLikeSchema = v.union([
  v.string(),
  v.pipe(
    v.number(),
    v.transform((value) => String(value))
  ),
])

const TimestampSchema = v.union([
  v.number(),
  v.pipe(
    v.string(),
    v.check((value) => value.trim() !== '' && Number.isFinite(Number(value))),
    v.transform((value) => Number(value))
  ),
])

export const SendMessageResponseSchema = v.looseObject({
  idMessage: nonEmptyString,
})

const CheckAccountFoundSchema = v.looseObject({
  exist: v.literal(true),
  chatId: nonEmptyString,
  fromCache: v.optional(v.boolean()),
})

const CheckAccountNotFoundSchema = v.looseObject({
  exist: v.literal(false),
  chatId: v.optional(v.string()),
  fromCache: v.optional(v.boolean()),
})

export const CheckAccountResponseSchema = v.union([
  CheckAccountFoundSchema,
  CheckAccountNotFoundSchema,
])

export const CheckAccountFailureSchema = v.looseObject({
  status: v.literal(false),
  reason: v.optional(nonEmptyString),
  message: v.optional(nonEmptyString),
  code: v.optional(nonEmptyString),
  data: v.optional(
    v.looseObject({
      reason: v.optional(nonEmptyString),
      message: v.optional(nonEmptyString),
    })
  ),
})

export function checkAccountFailureMessage(
  value: v.InferOutput<typeof CheckAccountFailureSchema>
): string {
  return (
    value.reason ??
    value.message ??
    value.data?.reason ??
    value.data?.message ??
    value.code ??
    'GREEN-API could not check this account'
  )
}

export const NotificationFailureSchema = v.looseObject({
  status: v.union([v.literal('error'), v.literal(false)]),
  message: v.optional(v.string()),
  reason: v.optional(v.string()),
  code: v.optional(v.string()),
})

const ReceiptIdSchema = v.union([
  v.pipe(v.number(), v.safeInteger()),
  v.pipe(
    v.string(),
    v.check((value) => /^\d+$/.test(value.trim()), 'receiptId must be numeric'),
    v.transform((value) => Number(value.trim())),
    v.pipe(v.number(), v.safeInteger())
  ),
])

const SenderDataSchema = v.looseObject({
  chatId: v.optional(StringLikeSchema),
  chatName: v.optional(StringLikeSchema),
})

const TextMessageDataSchema = v.looseObject({
  textMessage: v.optional(StringLikeSchema),
})

const ExtendedTextMessageDataSchema = v.looseObject({
  text: v.optional(StringLikeSchema),
})

const MessageDataSchema = v.looseObject({
  typeMessage: v.optional(v.string()),
  textMessageData: v.optional(TextMessageDataSchema),
  extendedTextMessageData: v.optional(ExtendedTextMessageDataSchema),
})

const NotificationBodySchema = v.looseObject({
  typeWebhook: v.optional(v.string()),
  idMessage: v.optional(StringLikeSchema),
  timestamp: v.optional(TimestampSchema),
  senderData: v.optional(SenderDataSchema),
  messageData: v.optional(MessageDataSchema),
})

export const NotificationSchema = v.looseObject({
  receiptId: ReceiptIdSchema,
  body: NotificationBodySchema,
})

export const ReceiptIdOnlySchema = v.looseObject({
  receiptId: ReceiptIdSchema,
})

export const DeleteNotificationResponseSchema = v.looseObject({
  result: v.boolean(),
  reason: v.optional(v.string()),
})

export const StateInstanceResponseSchema = v.looseObject({
  stateInstance: v.string(),
})

export function decode<T extends v.GenericSchema>(
  schema: T,
  value: unknown,
  message: string
): ResultType<v.InferOutput<T>, GreenApiError> {
  let parsed = v.safeParse(schema, value)
  if (parsed.success) return Result.ok(parsed.output)

  return Result.err(createInvalidResponseError(message))
}

export function toCheckAccountResult(
  value: v.InferOutput<typeof CheckAccountResponseSchema>
): CheckAccountResult {
  if (value.exist === true) {
    return value.fromCache === undefined
      ? { kind: 'found', chatId: value.chatId }
      : { kind: 'found', chatId: value.chatId, fromCache: value.fromCache }
  }

  return value.fromCache === undefined
    ? { kind: 'not_found' }
    : { kind: 'not_found', fromCache: value.fromCache }
}

export function toNotificationResponse(
  value: v.InferOutput<typeof NotificationSchema>
): ReceiveNotificationResponse {
  return {
    receiptId: value.receiptId,
    body: {
      ...(value.body.typeWebhook !== undefined ? { typeWebhook: value.body.typeWebhook } : {}),
      ...(value.body.idMessage !== undefined ? { idMessage: value.body.idMessage } : {}),
      ...(value.body.timestamp !== undefined ? { timestamp: value.body.timestamp } : {}),
      ...(value.body.senderData !== undefined ? { senderData: value.body.senderData } : {}),
      ...(value.body.messageData !== undefined
        ? {
            messageData: {
              ...(value.body.messageData.typeMessage !== undefined
                ? { typeMessage: value.body.messageData.typeMessage }
                : {}),
              ...(value.body.messageData.textMessageData?.textMessage !== undefined
                ? {
                    textMessageData: {
                      textMessage: value.body.messageData.textMessageData.textMessage,
                    },
                  }
                : {}),
              ...(value.body.messageData.extendedTextMessageData?.text !== undefined
                ? {
                    extendedTextMessageData: {
                      text: value.body.messageData.extendedTextMessageData.text,
                    },
                  }
                : {}),
            },
          }
        : {}),
    },
  }
}

export function notificationFailureMessage(
  value: v.InferOutput<typeof NotificationFailureSchema>
): string {
  let message = value.message?.trim()
  if (message) return message

  let reason = value.reason?.trim()
  if (reason) return reason

  let code = value.code?.trim()
  if (code) return code

  return 'GREEN-API could not return a notification'
}
