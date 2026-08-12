import {
  Component,
  useEffect,
  useReducer,
  type ComponentType,
  type ReactNode
} from 'react'
import type { RendererIncident } from '../../shared/contracts/runtime.js'

export type SurfaceId =
  'application' | 'session' | 'planner' | 'catalog' | 'hex'

export type ModuleFailure = Readonly<{
  phase: 'module-load' | 'render'
  error: Error
}>

export type ModuleRecoveryPolicy = Readonly<{
  moduleFailure: 'retry-or-reload'
  renderFailure: 'remount' | 'remount-or-return'
}>

export type ModuleHostProps<Props extends object> = Readonly<{
  workspace: SurfaceId
  load: () => Promise<{ default: ComponentType<Props> }>
  componentProps: Props
  loadingMessage: string
  failureMessage: string
  recoveryMessage: string
  retryLabel: string
  reloadLabel: string
  recoveryPolicy: ModuleRecoveryPolicy
  returnLabel?: string
  returnToSafeSurface?: () => void
  reportIncident: (incident: RendererIncident) => Promise<void>
  reloadRenderer: () => Promise<void>
}>

type ModuleState<Props extends object> =
  | Readonly<{ status: 'loading'; attempt: number }>
  | Readonly<{
      status: 'ready'
      attempt: number
      Surface: ComponentType<Props>
    }>
  | Readonly<{
      status: 'module-failed'
      attempt: number
      failure: ModuleFailure
    }>
  | Readonly<{
      status: 'render-failed'
      attempt: number
      failure: ModuleFailure
    }>

type ModuleAction<Props extends object> =
  | Readonly<{
      type: 'loaded'
      attempt: number
      Surface: ComponentType<Props>
    }>
  | Readonly<{
      type: 'failed'
      attempt: number
      failure: ModuleFailure
    }>
  | Readonly<{ type: 'retry' }>

function reduceModuleState<Props extends object>(
  state: ModuleState<Props>,
  action: ModuleAction<Props>
): ModuleState<Props> {
  if (action.type === 'retry')
    return { status: 'loading', attempt: state.attempt + 1 }
  if (action.attempt !== state.attempt) return state
  if (action.type === 'loaded')
    return { status: 'ready', attempt: state.attempt, Surface: action.Surface }
  return {
    status:
      action.failure.phase === 'module-load'
        ? 'module-failed'
        : 'render-failed',
    attempt: state.attempt,
    failure: action.failure
  }
}

type ModuleRenderBoundaryProps = Readonly<{
  children: ReactNode
  failed: (failure: ModuleFailure) => void
}>

class ModuleRenderBoundary extends Component<
  ModuleRenderBoundaryProps,
  Readonly<{ failed: boolean }>
> {
  override state = { failed: false }

  static getDerivedStateFromError(): Readonly<{ failed: boolean }> {
    return { failed: true }
  }

  override componentDidCatch(error: Error): void {
    this.props.failed({ phase: 'render', error })
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

/** Loads and isolates one module while leaving the surrounding shell usable. */
export function ModuleHost<Props extends object>(
  props: ModuleHostProps<Props>
) {
  const [state, dispatch] = useReducer(reduceModuleState<Props>, {
    status: 'loading',
    attempt: 0
  } as ModuleState<Props>)
  const { load, reportIncident, workspace } = props

  useEffect(() => {
    let current = true
    const attempt = state.attempt
    void load().then(
      (module) => {
        if (current)
          dispatch({ type: 'loaded', attempt, Surface: module.default })
      },
      (cause: unknown) => {
        if (!current) return
        const error = asError(cause)
        dispatch({
          type: 'failed',
          attempt,
          failure: { phase: 'module-load', error }
        })
        report(reportIncident, workspace, 'module-load', error)
      }
    )
    return () => {
      current = false
    }
  }, [load, reportIncident, state.attempt, workspace])

  function renderFailed(failure: ModuleFailure): void {
    dispatch({ type: 'failed', attempt: state.attempt, failure })
    report(reportIncident, workspace, failure.phase, failure.error)
  }

  if (state.status === 'module-failed' || state.status === 'render-failed')
    return (
      <section className="workspace-panel module-load-state" role="alert">
        <h2>{props.failureMessage}</h2>
        <p>{props.recoveryMessage}</p>
        <div className="workspace-recovery-actions">
          <button type="button" onClick={() => dispatch({ type: 'retry' })}>
            {props.retryLabel}
          </button>
          {state.status === 'module-failed' && (
            <button type="button" onClick={() => void props.reloadRenderer()}>
              {props.reloadLabel}
            </button>
          )}
          {state.status === 'render-failed' &&
            props.recoveryPolicy.renderFailure === 'remount-or-return' &&
            props.returnToSafeSurface &&
            props.returnLabel && (
              <button type="button" onClick={props.returnToSafeSurface}>
                {props.returnLabel}
              </button>
            )}
        </div>
      </section>
    )

  if (state.status === 'loading')
    return (
      <section
        className="workspace-panel module-load-state"
        role="status"
        aria-live="polite"
      >
        <p>{props.loadingMessage}</p>
      </section>
    )

  const Surface = state.Surface
  return (
    <ModuleRenderBoundary failed={renderFailed}>
      <Surface {...props.componentProps} />
    </ModuleRenderBoundary>
  )
}

function report(
  reportIncident: (incident: RendererIncident) => Promise<void>,
  workspace: SurfaceId,
  phase: ModuleFailure['phase'],
  error: Error
): void {
  const isApplication = workspace === 'application'
  void reportIncident({
    scope: isApplication
      ? 'shell'
      : workspace === 'hex'
        ? 'canvas'
        : 'workspace',
    workspace,
    phase,
    code: `workspace.${phase}`,
    errorName: safeErrorName(error.name),
    message: 'Renderer surface failed',
    recoveryClass:
      phase === 'module-load'
        ? isApplication
          ? 'reload-renderer'
          : 'retry-module'
        : workspace === 'hex'
          ? 'remount-surface'
          : 'return-session'
  }).catch(() => undefined)
}

function safeErrorName(name: string): string {
  return /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(name) ? name : 'Error'
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}
