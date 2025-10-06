export type RendererQuery = Record<string, unknown>;

export interface RendererError {
  message: string;
  cause?: unknown;
  recoverable: boolean;
  code?: string;
}

export interface RendererTelemetry {
  featureFlag: string;
  parityCounter?: (metric: string, delta?: number) => void;
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) => void;
}

export interface RendererContext<State = unknown> {
  initialState: State;
  query: RendererQuery;
  telemetry: RendererTelemetry;
  killSwitch: () => boolean;
}

export interface RendererLifecycleHooks<State = unknown> {
  onBeforeMount?: (context: RendererContext<State>) => Promise<void> | void;
  onAfterMount?: (context: RendererContext<State>) => Promise<void> | void;
  onBeforeUnmount?: (context: RendererContext<State>) => Promise<void> | void;
}

export interface RendererEvent {
  type: string;
  payload?: unknown;
}

export interface RendererInstance<State = unknown> {
  readonly id: string;
  connect: (hooks?: RendererLifecycleHooks<State>) => Promise<void>;
  handleQuery: (query: RendererQuery) => Promise<void>;
  handleEvent: (event: RendererEvent) => Promise<void>;
  dispose: () => Promise<void>;
  getState: () => State;
}

export interface RendererFactoryOptions<State = unknown> {
  featureFlag: string;
  supportsLegacyContract: boolean;
  lifecycleDefaults?: RendererLifecycleHooks<State>;
}

export interface RendererFactory<State = unknown> {
  bootstrap: (context: RendererContext<State>, options: RendererFactoryOptions<State>) => Promise<RendererInstance<State>>;
  supportsQuery: (queryKey: string) => boolean;
  toLegacyBridge?: (instance: RendererInstance<State>) => unknown;
}

