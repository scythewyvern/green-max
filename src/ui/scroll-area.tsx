import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'
import { clsx } from 'clsx'
import type { Ref } from 'react'

import styles from './scroll-area.module.css'

interface ScrollAreaProps extends ScrollAreaPrimitive.Root.Props {
  viewportRef?: Ref<HTMLDivElement>
}

function ScrollArea({ className, children, viewportRef, ...props }: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot='scroll-area'
      className={clsx(styles.ScrollArea, className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot='scroll-area-viewport'
        className={styles.Viewport}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot='scroll-area-scrollbar'
      data-orientation={orientation}
      orientation={orientation}
      className={clsx(styles.Scrollbar, className)}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb data-slot='scroll-area-thumb' className={styles.Thumb} />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea }
