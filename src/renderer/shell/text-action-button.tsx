import type { ButtonHTMLAttributes } from 'react'
import './text-action-button.css'

export function TextActionButton(
  props: ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className, type, ...buttonProps } = props
  return (
    <button
      {...buttonProps}
      type={type ?? 'button'}
      className={`text-action-button${className ? ` ${className}` : ''}`}
    />
  )
}
