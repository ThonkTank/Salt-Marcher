import { forwardRef, type HTMLAttributes } from 'react'

/** Shared accessible primitive for non-modal popovers and floating windows. */
export const NonModalSurface = forwardRef<
  HTMLElement,
  HTMLAttributes<HTMLElement>
>(function NonModalSurface(props, ref) {
  return <section ref={ref} role="region" {...props} />
})
