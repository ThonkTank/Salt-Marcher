import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react'

type WorkspaceLoadBoundaryProps = Readonly<{
  children: ReactNode
  loadingMessage: string
  failureMessage: string
  recoveryMessage: string
  reloadLabel: string
  reload?: () => void
  onError?: (error: Error, info: ErrorInfo) => void
}>

type WorkspaceErrorBoundaryState = Readonly<{ failed: boolean }>

class WorkspaceErrorBoundary extends Component<
  WorkspaceLoadBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  override state: WorkspaceErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): WorkspaceErrorBoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  override render(): ReactNode {
    if (this.state.failed)
      return (
        <section className="workspace-panel workspace-load-state" role="alert">
          <h2>{this.props.failureMessage}</h2>
          <p>{this.props.recoveryMessage}</p>
          <button type="button" onClick={this.props.reload ?? reloadRenderer}>
            {this.props.reloadLabel}
          </button>
        </section>
      )
    return this.props.children
  }
}

/** Keeps the application shell available while a lazy workspace loads or fails. */
export function WorkspaceLoadBoundary(props: WorkspaceLoadBoundaryProps) {
  return (
    <WorkspaceErrorBoundary {...props}>
      <Suspense
        fallback={
          <section
            className="workspace-panel workspace-load-state"
            role="status"
            aria-live="polite"
          >
            <p>{props.loadingMessage}</p>
          </section>
        }
      >
        {props.children}
      </Suspense>
    </WorkspaceErrorBoundary>
  )
}

function reloadRenderer(): void {
  window.location.reload()
}
