export const routePaths = {
  login: '/login',
  join: '/join',
  chatPattern: '/chat/:chatId',
  chat: (chatId: string) => `/chat/${encodeURIComponent(chatId)}`,
} as const
