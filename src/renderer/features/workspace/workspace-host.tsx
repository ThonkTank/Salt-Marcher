import {
  Component,
  useEffect,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode
} from 'react'
import type { RendererIncident } from '../../../shared/contracts/runtime.js'

export type WorkspaceId = 'session' | 'catalog' | 'hex'

type WorkspaceHostProps<Props extends object> = Readonly<{
  workspace: WorkspaceId
  load: () => Promise<{ default: ComponentType<Props> }>
  componentProps: Props
  loadingMessage: string
  failureMessage: string
  recoveryMessage: string
  retryLabel: string
  reloadLabel: string
  reportIncident: (incident: RendererIncident) => Promise<void>
  reloadRenderer: () => Promise<void>
}>

type Failure = Readonly<{ phase: 'module-load' | 'render'; error: Error }>

type WorkspaceRenderBoundaryProps = Readonly<{
  children: ReactNode
  resetKey: number
  failed: (failure: Failure) => void
}>

type WorkspaceRenderBoundaryState = Readonly<{ failed: boolean }>

class WorkspaceRenderBoundary extends Component<
  WorkspaceRenderBoundaryProps,
  WorkspaceRenderBoundaryState
> {
  override state: WorkspaceRenderBoundaryState = { failed: false }

  static getDerivedStateFromError(): WorkspaceRenderBoundaryState {
    return { failed: true }
  }

  override componentDidUpdate(previous: WorkspaceRenderBoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.failed)
      this.setState({ failed: false })
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.failed({ phase: 'render', error })
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

/** Loads and isolates one workspace module while leaving the shell operational. */
export function WorkspaceHost<Props extends object>(
  props: WorkspaceHostProps<Props>
) {
  const [Surface, setSurface] = useState<ComponentType<Props> | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    setSurface(null)
    setFailure(null)
    void props.load().then(
      (module) => {
        if (current) setSurface(() => module.default)
      },
      (cause: unknown) => {
        if (!current) return
        const error = asError(cause)
        setFailure({ phase: 'module-load', error })
        report(props, 'module-load', error)
      }
    )
    return () => {
      current = false
    }
  }, [attempt, props.load])

  function fail(next: Failure): void {
    setFailure(next)
    report(props, next.phase, next.error)
  }

  if (failure)
    return (
      <section className="workspace-panel workspace-load-state" role="alert">
        <h2>{props.failureMessage}</h2>
        <p>{props.recoveryMessage}</p>
        <div className="workspace-recovery-actions">
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {props.retryLabel}
          </button>
          <button type="button" onClick={() => void props.reloadRenderer()}>
            {props.reloadLabel}
          </button>
        </div>
      </section>
    )

  if (!Surface)
    return (
      <section
        className="workspace-panel workspace-load-state"
        role="status"
        aria-live="polite"
      >
        <p>{props.loadingMessage}</p>
      </section>
    )

  return (
    <WorkspaceRenderBoundary resetKey={attempt} failed={fail}>
      <Surface {...props.componentProps} />
    </WorkspaceRenderBoundary>
  )
}

function report<Props extends object>(
  props: WorkspaceHostProps<Props>,
  phase: Failure['phase'],
  error: Error
): void {
  void props
    .reportIncident({
      workspace: props.workspace,
      phase,
      code: `workspace.${phase}`,
      errorName: error.name || 'Error',
      message: error.message || 'Unknown workspace failure',
      recoverable: true
    })
    .catch(() => undefined)
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}
