import type { FormEvent, ReactNode } from 'react'
import { IlluminatedHeading } from './illuminated-heading.js'
import { ModalCloseButton, ModalDialog, ModalForm } from './modal-dialog.js'
import './editor-dialog-frame.css'

export function EditorDialogFrame(props: {
  className: string
  ariaLabel: string
  breadcrumb: string
  title: string
  closeLabel: string
  busy: boolean
  onClose: () => void
  onSubmit: () => void
  children: ReactNode
  footer: ReactNode
  headerClassName?: string
  bodyClassName?: string
  footerClassName?: string
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    props.onSubmit()
  }
  return (
    <ModalDialog
      className={`editor-dialog-frame ${props.className}`}
      ariaLabel={props.ariaLabel}
      busy={props.busy}
      onClose={props.onClose}
    >
      <ModalForm className="editor-dialog-form" onSubmit={submit}>
        <header
          className={`editor-dialog-header${props.headerClassName ? ` ${props.headerClassName}` : ''}`}
        >
          <div>
            <p className="section-kicker">{props.breadcrumb}</p>
            <IlluminatedHeading title={props.title} />
          </div>
          <ModalCloseButton aria-label={props.closeLabel}>×</ModalCloseButton>
        </header>
        <div
          className={`editor-dialog-body${props.bodyClassName ? ` ${props.bodyClassName}` : ''}`}
        >
          {props.children}
        </div>
        <footer
          className={`editor-dialog-footer${props.footerClassName ? ` ${props.footerClassName}` : ''}`}
        >
          {props.footer}
        </footer>
      </ModalForm>
    </ModalDialog>
  )
}
