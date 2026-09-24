import { describe, expect, test } from 'bun:test'

import { acknowledgementResponse, createTestApi, getRequestUrl } from '#/test-support/api'

import { GreenApiError } from './index'

describe('Api configuration', () => {
  test('rejects an invalid api url before transport use', () => {
    let requests = 0

    expect(() =>
      createTestApi({
        apiUrl: 'not-a-url',
        fetcher: async () => {
          requests += 1
          return Response.json({})
        },
      })
    ).toThrow('API URL must be a valid HTTPS URL or loopback HTTP URL')
    expect(requests).toBe(0)
  })

  test('validates timeout options before creating a client', () => {
    expect(() => createTestApi({ receiveTimeout: 4 })).toThrow(
      'receiveTimeout must be an integer between 5 and 60 seconds'
    )
    expect(() => createTestApi({ receiveTimeout: 61 })).toThrow(
      'receiveTimeout must be an integer between 5 and 60 seconds'
    )
    expect(() => createTestApi({ requestTimeoutMs: 0 })).toThrow(
      'requestTimeoutMs must be a positive integer'
    )
    expect(() => createTestApi({ requestTimeoutMs: 1.5 })).toThrow(
      'requestTimeoutMs must be a positive integer'
    )
  })

  test('requires non-empty credentials', () => {
    expect(() => createTestApi({ idInstance: '  ' })).toThrow('Instance ID is required')
    expect(() => createTestApi({ apiTokenInstance: '' })).toThrow('API token is required')
  })

  test('normalizes a per-instance url before building endpoints', async () => {
    let requestUrl = ''
    let api = createTestApi({
      apiUrl: ' https://3103.api.green-api.test/// ',
      fetcher: async (input) => {
        requestUrl = getRequestUrl(input)
        return Response.json({ stateInstance: 'authorized' })
      },
    })

    await api.getStateInstance()

    expect(requestUrl).toBe(
      'https://3103.api.green-api.test/waInstance1100000000/getStateInstance/secret-token'
    )
  })
})

describe('Api.checkAccount', () => {
  test('returns a typed recipient result for an existing MAX account', async () => {
    let api = createTestApi({
      fetcher: async () =>
        Response.json({ exist: true, chatId: '10000000', fromCache: false }),
    })

    let result = await api.checkAccount({ phoneNumber: 79991234567 })

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toEqual({
        kind: 'found',
        chatId: '10000000',
        fromCache: false,
      })
    }
  })

  test('returns a typed recipient result when the phone number is not on MAX', async () => {
    let api = createTestApi({
      fetcher: async () => Response.json({ exist: false, chatId: '', fromCache: true }),
    })

    let result = await api.checkAccount({ phoneNumber: 79991234567 })

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toEqual({ kind: 'not_found', fromCache: true })
    }
  })

  test('preserves a documented service-level failure returned with HTTP 200', async () => {
    let api = createTestApi({
      fetcher: async () =>
        Response.json({ status: false, reason: 'instance is starting or not authorized' }),
    })

    let result = await api.checkAccount({ phoneNumber: 79991234567 })

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('service')
      expect(result.error.reason).toBe('instance is starting or not authorized')
      expect(result.error.retryable).toBe(false)
    }
  })

  test('preserves nested service failures from alternate API error envelopes', async () => {
    let api = createTestApi({
      fetcher: async () =>
        Response.json({
          status: false,
          data: { status: 'fail', reason: 'rate_limit_exceeded' },
        }),
    })

    let result = await api.checkAccount({ phoneNumber: 79991234567 })

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('service')
      expect(result.error.reason).toBe('rate_limit_exceeded')
    }
  })
})

describe('Api.receiveNotification', () => {
  test('decodes a notification returned by the HTTP queue', async () => {
    let api = createTestApi({
      fetcher: async () =>
        Response.json({
          receiptId: 123,
          body: {
            typeWebhook: 'incomingMessageReceived',
            idMessage: 'incoming-1',
            timestamp: 1763115112,
            senderData: { chatId: 'chat-7', chatName: 'Recipient' },
            messageData: {
              typeMessage: 'textMessage',
              textMessageData: { textMessage: 'Hello from MAX' },
            },
          },
        }),
    })

    let result = await api.receiveNotification()

    expect(result.status).toBe('ok')
    if (result.status === 'ok' && result.value && !('undecodable' in result.value)) {
      expect(result.value.receiptId).toBe(123)
      expect(result.value.body.idMessage).toBe('incoming-1')
      expect(result.value.body.messageData?.textMessageData?.textMessage).toBe(
        'Hello from MAX'
      )
    }
  })

  test('normalizes a numeric receipt id returned as a string', async () => {
    let api = createTestApi({
      fetcher: async () =>
        Response.json({
          receiptId: '123',
          body: {
            typeWebhook: 'incomingMessageReceived',
            idMessage: 'incoming-string-receipt',
            senderData: { chatId: 'chat-7' },
            messageData: {
              typeMessage: 'textMessage',
              textMessageData: { textMessage: 'Hello' },
            },
          },
        }),
    })

    let result = await api.receiveNotification()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value?.receiptId).toBe(123)
    }
  })

  test('preserves the documented receive error envelope', async () => {
    let api = createTestApi({
      fetcher: async () =>
        Response.json({
          code: 'INVALID_PARAM',
          message: 'Message cannot be received because custom webhook url is set.',
          status: 'error',
        }),
    })

    let result = await api.receiveNotification()

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('service')
      expect(result.error.reason).toBe(
        'Message cannot be received because custom webhook url is set.'
      )
    }
  })

  test('treats a JSON null long-poll response as no notification', async () => {
    let api = createTestApi({
      fetcher: async () => Response.json(null),
    })

    let result = await api.receiveNotification()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toBeNull()
    }
  })

  test('treats an empty long-poll response as no notification', async () => {
    let api = createTestApi({
      fetcher: async () => new Response('', { status: 200 }),
    })

    let result = await api.receiveNotification()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toBeNull()
    }
  })

  test('treats the documented 408 timeout as no notification', async () => {
    let api = createTestApi({
      fetcher: async () => new Response('', { status: 408 }),
    })

    let result = await api.receiveNotification()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toBeNull()
    }
  })

  test('coerces numeric chat ids and reads extended text messages', async () => {
    let api = createTestApi({
      fetcher: async () =>
        Response.json({
          receiptId: 124,
          body: {
            typeWebhook: 'incomingMessageReceived',
            idMessage: 1763115112345,
            timestamp: 1763115112,
            senderData: { chatId: 10000000, chatName: 'Recipient' },
            messageData: {
              typeMessage: 'extendedTextMessage',
              extendedTextMessageData: {
                text: 'See https://green-api.com/ for docs',
                title: 'See https://green-api.com/ for docs',
              },
            },
          },
        }),
    })

    let result = await api.receiveNotification()

    expect(result.status).toBe('ok')
    if (result.status === 'ok' && result.value && !('undecodable' in result.value)) {
      expect(result.value.receiptId).toBe(124)
      expect(result.value.body.senderData?.chatId).toBe('10000000')
      expect(result.value.body.idMessage).toBe('1763115112345')
      expect(result.value.body.messageData?.extendedTextMessageData?.text).toBe(
        'See https://green-api.com/ for docs'
      )
    } else {
      throw new Error('expected a decodable notification')
    }
  })

  test('returns a deletable stub for unknown bodies instead of erroring', async () => {
    let api = createTestApi({
      fetcher: async () =>
        Response.json({
          receiptId: 125,
          body: {
            typeWebhook: 'someFutureMessageType',
            senderData: { chatId: { weird: ['not', 'a', 'string'] } },
            messageData: 'not-an-object-in-this-future-format',
          },
        }),
    })

    let result = await api.receiveNotification()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toEqual({ receiptId: 125, undecodable: true })
    }
  })

  test('still errors when even the receipt id is missing', async () => {
    let api = createTestApi({
      fetcher: async () => Response.json({ body: { typeWebhook: '???' } }),
    })

    let result = await api.receiveNotification()

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('invalid-response')
    }
  })
})

describe('Api.sendMessage', () => {
  test('posts a text message and returns the decoded message id', async () => {
    let requestUrl = ''
    let requestInit: RequestInit | undefined

    let api = createTestApi({
      fetcher: async (input, init) => {
        requestUrl = getRequestUrl(input)
        requestInit = init
        return Response.json({ idMessage: 'message-42' })
      },
    })

    let result = await api.sendMessage({ chatId: 'chat-7', message: 'Hello' })

    expect(requestUrl).toBe(
      'https://api.green-api.test/waInstance1100000000/sendMessage/secret-token'
    )
    expect(requestInit?.method).toBe('POST')
    expect(requestInit?.body).toBe(JSON.stringify({ chatId: 'chat-7', message: 'Hello' }))
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.value).toEqual({ idMessage: 'message-42' })
    }
  })
  test('maps HTTP failures to a retryable typed error', async () => {
    let api = createTestApi({
      fetcher: async () =>
        new Response('server error', { status: 503, statusText: 'Unavailable' }),
    })

    let result = await api.sendMessage({ chatId: 'chat-7', message: 'Hello' })

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('http')
      expect(result.error.status).toBe(503)
      expect(result.error.reason).toBe('server error')
      expect(result.error.retryable).toBe(true)
    }
  })

  test('marks a client-closed request as retryable', async () => {
    let api = createTestApi({
      fetcher: async () => new Response('closed', { status: 499, statusText: 'Closed' }),
    })

    let result = await api.sendMessage({ chatId: 'chat-7', message: 'Hello' })

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.status).toBe(499)
      expect(result.error.retryable).toBe(true)
    }
  })

  test('rejects malformed successful responses instead of casting them', async () => {
    let api = createTestApi({
      fetcher: async () => Response.json({ unexpected: true }),
    })

    let result = await api.sendMessage({ chatId: 'chat-7', message: 'Hello' })

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('invalid-response')
      expect(result.error.retryable).toBe(false)
    }
  })

  test('maps malformed JSON to an invalid-response error', async () => {
    let api = createTestApi({
      fetcher: async () => new Response('{not-json', { status: 200 }),
    })

    let result = await api.sendMessage({ chatId: 'chat-7', message: 'Hello' })

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('invalid-response')
      expect(result.error.retryable).toBe(false)
    }
  })
})

describe('Api.deleteNotification', () => {
  test('returns a service failure when the queue rejects acknowledgment', async () => {
    let api = createTestApi({
      fetcher: async () => Response.json({ result: false, reason: 'already deleted' }),
    })

    let result = await api.deleteNotification(123)

    expect(result.status).toBe('error')
    if (result.status === 'error' && GreenApiError.is(result.error)) {
      expect(result.error.kind).toBe('service')
      expect(result.error.reason).toBe('already deleted')
    }
  })

  test('acknowledges a processed notification', async () => {
    let requestUrl = ''
    let requestInit: RequestInit | undefined
    let api = createTestApi({
      fetcher: async (input, init) => {
        requestUrl = getRequestUrl(input)
        requestInit = init
        return acknowledgementResponse()
      },
    })

    let result = await api.deleteNotification(123)

    expect(requestUrl).toBe(
      'https://api.green-api.test/waInstance1100000000/deleteNotification/secret-token/123'
    )
    expect(requestInit?.method).toBe('DELETE')
    expect(result.status).toBe('ok')
  })
})
