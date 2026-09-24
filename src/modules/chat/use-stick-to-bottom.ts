import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

import type { ChatMessage } from './transcript'

const STICK_THRESHOLD_PX = 80

export function useStickToBottom(messages: ChatMessage[]): RefObject<HTMLDivElement | null> {
  let viewportRef = useRef<HTMLDivElement | null>(null)
  let stickToBottomRef = useRef(true)
  let firstRenderRef = useRef(true)

  useEffect(() => {
    let viewport = viewportRef.current
    if (!viewport) return

    viewport.setAttribute('data-live', '')

    function handleScroll() {
      let distanceFromBottom =
        viewport!.scrollHeight - viewport!.scrollTop - viewport!.clientHeight
      stickToBottomRef.current = distanceFromBottom < STICK_THRESHOLD_PX
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [])

  useLayoutEffect(() => {
    let viewport = viewportRef.current
    if (!viewport) return

    let last = messages[messages.length - 1]
    let shouldStick =
      firstRenderRef.current || stickToBottomRef.current || last?.direction === 'outgoing'
    if (shouldStick) {
      viewport.scrollTop = viewport.scrollHeight
    }
    firstRenderRef.current = false
  }, [messages])

  return viewportRef
}
