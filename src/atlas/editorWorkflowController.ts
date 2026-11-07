import { WireError } from "../wireError";
import type { Gesture, Evaluation } from "./interaction";
import type { EditorDraft } from "./roadDraft";
import { toDraftIntent } from "./roadDraft";
import type { Intent, Scene, ValidPreview, Version } from "./model";
import { sameVersion } from "./documentVersion";
import {
  captureOperation,
  captureDraftOperation,
  captureGestureOperation,
  captureHouseDrawingOperation,
  operationTarget,
  recheckOperation,
  type OperationSource,
} from "./workflowOperations";
import {
  type Candidate,
  type CandidateToken,
  type CheckedPreview,
  type EditorWorkflow,
  type ExactIntent,
  type WorkflowGate,
  type PlannedAction,
  type WorkflowEvent,
  canAcceptWorkflow,
  canRecheckWorkflow,
  workflowRequest,
  geometryState,
  draftState,
  type QueueIntent,
  type RequestToken,
  idleWorkflow,
  isQueueIntent,
  isExact,
  isSurfaceWorkflow,
  isOwner,
  sameCandidate,
  sameRequest,
  transition,
  workflowPointer,
} from "./editorWorkflow";

type EffectResult<T> =
  | { kind: "value"; value: T }
  | { kind: "obsolete" }
  | { kind: "error"; message: string; error: unknown };

// Writes can advance the revision before completing: dispatch and completion
// therefore have separate ownership checks. Accepted writes are never retried.
async function ownedEffect<T>(
  mayDispatch: () => boolean,
  run: () => Promise<T>,
  mayComplete = mayDispatch,
): Promise<EffectResult<T>> {
  if (!mayDispatch()) return { kind: "obsolete" };
  try {
    const value = await run();
    return mayComplete() ? { kind: "value", value } : { kind: "obsolete" };
  } catch (error) {
    return mayComplete()
      ? { kind: "error", message: String(error), error }
      : { kind: "obsolete" };
  }
}

export type WorkflowPorts = {
  terrain?: {
    begin: (intent: Extract<Intent, { type: "terrainStroke" }>) => void;
    append: (
      points: Extract<Intent, { type: "terrainStroke" }>["brush"]["points"],
      view: Extract<Intent, { type: "terrainStroke" }>["view"],
    ) => void;
    finish: () => void;
  };
  gate: () => WorkflowGate;
  context: () => string;
  source: () => OperationSource;
  inspect: (
    action: PlannedAction,
    version: Version,
  ) => Promise<CheckedPreview | null>;
  cancelInspect: () => void;
  commitExact: (
    action: PlannedAction,
    version: Version,
    owns: () => boolean,
  ) => Promise<ValidPreview | null>;
  queue: (intent: QueueIntent) => Promise<ValidPreview | null>;
  read: (
    id: string,
    version: Version,
    wanted: () => boolean,
  ) => Promise<Scene | undefined>;
  completed: (intent: ExactIntent, result: ValidPreview) => void;
  error: (message: string) => void;
};
/** Single synchronous owner. React only subscribes to its immutable snapshots. */
export class EditorWorkflowController {
  private state: EditorWorkflow = idleWorkflow();
  private listeners = new Set<() => void>();
  private nextWorkflow = 0;
  private nextCandidate = 0;
  private nextRequest = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private live = true;
  private wasExclusive = false;
  constructor(private ports: WorkflowPorts) {}
  setPorts(ports: WorkflowPorts) {
    this.ports = ports;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  dispatch = (event: WorkflowEvent) => {
    const next = transition(this.state, event);
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  };
  activate() {
    this.live = true;
  }
  dispose() {
    this.live = false;
    this.cancel();
  }
  private stopCheck() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.ports.cancelInspect();
  }
  cancel = () => {
    this.ports.terrain?.finish();
    this.stopCheck();
    this.dispatch({ type: "cancel" });
  };
  private fail(message: string) {
    this.cancel();
    this.ports.error(message);
  }
  private common(id: number, version: Version) {
    return {
      id,
      sessionId: version.sessionId,
      context: this.ports.context(),
      navigation: null,
      guide: null,
    };
  }
  private available(queue = false) {
    const g = this.ports.gate();
    return this.live &&
      g.version &&
      !g.exclusive &&
      !g.uncertain &&
      (queue || g.pending === 0)
      ? g.version
      : null;
  }
  private ownsLifetime(id: number, sessionId: string, context: string) {
    const s = this.state;
    return (
      this.live &&
      s.kind !== "idle" &&
      s.id === id &&
      s.sessionId === sessionId &&
      s.context === context &&
      this.ports.context() === context &&
      this.ports.gate().version?.sessionId === sessionId
    );
  }
  private ownsReadVersion(version: Version) {
    return sameVersion(this.available(), version);
  }
  private ownsRequest(request: RequestToken) {
    const s = this.state;
    const active = workflowRequest(s);
    return (
      s.kind !== "idle" &&
      !!active &&
      sameRequest(active, request) &&
      this.ownsLifetime(
        request.candidate.workflowId,
        request.candidate.version.sessionId,
        s.context,
      ) &&
      this.ownsReadVersion(request.candidate.version)
    );
  }
  private token(workflowId: number, version: Version): CandidateToken {
    return {
      workflowId,
      candidateId: ++this.nextCandidate,
      version: { sessionId: version.sessionId, revision: version.revision },
    };
  }
  private request(candidate: CandidateToken): RequestToken {
    return { candidate, requestId: ++this.nextRequest };
  }
  private source(version: Version): OperationSource {
    const source = this.ports.source();
    return sameVersion(source.scene?.status, version)
      ? source
      : { scene: undefined };
  }
  private candidate(
    id: number,
    intent: ExactIntent,
    version: Version,
    autoFinish: boolean,
    final = autoFinish,
  ): Candidate {
    return {
      token: this.token(id, version),
      intent: structuredClone(intent),
      autoFinish,
      final,
    };
  }
  private surfaceChecking = false;
  private checkSurface() {
    const state = this.state;
    if (
      this.surfaceChecking ||
      !isSurfaceWorkflow(state) ||
      !state.candidate ||
      !this.ownsReadVersion(state.basis)
    )
      return;
    const candidate = state.candidate;
    this.surfaceChecking = true;
    void this.ports
      .inspect(
        { operationId: candidate.token.candidateId, intent: candidate.intent },
        state.basis,
      )
      .then((preview) => {
        if (
          preview &&
          this.ownsLifetime(state.id, state.sessionId, state.context) &&
          this.ownsReadVersion(state.basis)
        )
          this.dispatch({
            type: "surfacePreview",
            workflowId: state.id,
            preview,
          });
      })
      .catch(() => {})
      .finally(() => {
        this.surfaceChecking = false;
        const next = this.state;
        if (
          isSurfaceWorkflow(next) &&
          next.candidate?.token.candidateId !== candidate.token.candidateId
        )
          this.checkSurface();
      });
  }
  private publish(state: EditorWorkflow, immediate = false) {
    const pointer = workflowPointer(state);
    if (this.ports.terrain && pointer?.kind === "terrain" && !pointer.water) {
      this.dispatch({ type: "begin", state });
      this.ports.terrain.begin({
        type: "terrainStroke",
        brush: pointer.brush,
        view: pointer.view,
      });
      return;
    }
    if (isOwner(state) && !state.pointer) {
      if (!state.candidate) {
        this.cancel();
        return;
      }
      if (state.stage.resolved) {
        state = geometryState(
          {
            ...state,
            basis: { ...state.stage.version },
            stage: { phase: "editing" },
          },
          state.operation,
          null,
        );
        immediate = true;
      }
    }
    if (isSurfaceWorkflow(state)) {
      clearTimeout(this.timer);
      this.dispatch({ type: "begin", state });
      this.checkSurface();
      return;
    }
    this.stopCheck();
    this.dispatch({ type: "begin", state });
    if (isExact(state) && state.candidate && state.stage.phase !== "stale") {
      if (state.kind === "geometry" && state.candidate.autoFinish)
        void this.accept();
      else if (immediate) this.check(state.candidate);
      else this.timer = setTimeout(() => this.check(state.candidate!), 100);
    }
  }
  beginDraft = (
    value: EditorDraft,
    pointer: Exclude<Gesture, { kind: "pan" }> | null = null,
    rollback: EditorDraft | null = null,
  ) => {
    const currentVersion = this.available();
    if (!currentVersion) return;
    const old = this.state;
    // Editing an existing stale draft is not consent to rebase it. Preserve
    // its basis until recheck has read the current referenced road header.
    const stale = old.kind === "draft" && old.stage.phase === "stale";
    const version = stale ? old.basis : currentVersion;
    const id = old.kind === "draft" ? old.id : ++this.nextWorkflow;
    const draft = structuredClone(value),
      intent = toDraftIntent(draft);
    if (draft.kind === "editRoad" || draft.kind === "editArea") {
      if (intent) this.beginIntent(intent, !pointer, pointer, draft);
      return;
    }
    const captured = captureDraftOperation(
      draft,
      this.source(currentVersion),
      old.kind === "draft" ? old.operation : undefined,
    );
    if (!captured.ok) {
      this.ports.error(captured.message);
      return;
    }
    const operation = captured.operation;
    this.publish(
      draftState(
        {
          ...this.common(id, version),
          basis: { sessionId: version.sessionId, revision: version.revision },
          kind: "draft",
          candidate: intent
            ? this.candidate(id, intent as ExactIntent, version, false)
            : null,
          stage: stale ? old.stage : { phase: "editing" },
          rollback: structuredClone(rollback),
        },
        operation,
        pointer,
      ),
    );
  };
  editRiver = (
    intent: Extract<Intent, { type: "riverEdit" }>,
    pointer: Extract<Gesture, { kind: "river" }> | null = null,
    append?: "start" | "end",
  ) => {
    const version = this.available();
    if (!version) return;
    const old = this.state;
    const prior =
      old.kind === "geometry" && old.operation.kind === "river" && isExact(old)
        ? old
        : null;
    if (prior?.stage.phase === "committing") return;
    const basis = prior?.basis ?? version;
    const id = prior?.id ?? ++this.nextWorkflow;
    const complete =
      intent.action.kind !== "put" || intent.action.nodes.length >= 2;
    this.publish({
      ...this.common(id, basis),
      kind: "geometry",
      rollback: null,
      pointer,
      basis,
      operation: {
        kind: "river",
        intent: structuredClone(intent),
        append:
          append ??
          (prior?.operation.kind === "river" ? prior.operation.append : null),
      },
      candidate: complete ? this.candidate(id, intent, basis, false) : null,
      stage:
        prior?.stage.phase === "stale" ? prior.stage : { phase: "editing" },
    });
  };
  beginIntent = (
    intent: Intent,
    autoFinish = true,
    pointer: Exclude<Gesture, { kind: "pan" }> | null = null,
    draft: EditorDraft | null = null,
  ) => {
    if (isQueueIntent(intent)) {
      if (!this.available(true)) return Promise.resolve(null);
      if (isExact(this.state)) {
        this.stopCheck();
        this.dispatch({
          type: "stale",
          message: "Dokumentstand geändert. Vorschau erneut prüfen.",
        });
      } else this.cancel();
      // Queue admission is synchronous; subsequent gestures do not belong to its completion.
      return this.ports.queue(structuredClone(intent));
    }
    const version = this.available();
    if (!version) return Promise.resolve(null);
    const exact = intent as ExactIntent;
    const old = this.state;
    const samePopulation =
      exact.type === "populate" &&
      old.kind === "populate" &&
      old.operation.roadId === exact.roadId;
    const sameRoughening =
      exact.type === "roughenRoad" &&
      old.kind === "geometry" &&
      old.candidate?.intent.type === "roughenRoad" &&
      old.candidate.intent.roadId === exact.roadId;
    if (
      isExact(old) &&
      old.stage.phase === "stale" &&
      (samePopulation || sameRoughening)
    ) {
      this.publish({
        ...old,
        candidate: this.candidate(old.id, exact, old.basis, false),
      });
      return Promise.resolve(null);
    }
    const captured = captureOperation(exact, this.source(version), draft);
    if (!captured.ok) {
      this.ports.error(captured.message);
      return Promise.resolve(null);
    }
    const operation = captured.operation;
    const id = samePopulation ? old.id : ++this.nextWorkflow,
      candidate = this.candidate(
        id,
        exact,
        version,
        autoFinish && exact.type !== "delete" && exact.type !== "populate",
      );
    const common = {
      ...this.common(id, version),
      basis: { sessionId: version.sessionId, revision: version.revision },
      candidate,
    };
    switch (operation.kind) {
      case "newRoad":
      case "extendRoad":
      case "newArea":
        throw Error("Neue Geometrie muss als Entwurf beginnen");
      case "delete":
        this.publish(
          {
            ...common,
            kind: "delete",
            operation,
            stage: {
              phase: "checking",
              request: this.request(candidate.token),
            },
          },
          true,
        );
        break;
      case "populate":
        this.publish({
          ...common,
          kind: "populate",
          operation,
          stage: { phase: "editing" },
        });
        break;
      default:
        this.publish(
          geometryState(
            {
              ...common,
              kind: "geometry",
              stage: { phase: "editing" },
              rollback: null,
            },
            operation,
            pointer,
          ),
          !pointer && autoFinish,
        );
    }
    return Promise.resolve(null);
  };
  beginGesture = (gesture: Gesture, rollback: EditorDraft | null = null) => {
    if (gesture.kind === "pan") {
      this.dispatch({ type: "pan", gesture: structuredClone(gesture) });
      return;
    }
    if (gesture.kind === "parcel" && gesture.draft) {
      this.beginDraft(gesture.draft, gesture, rollback);
      return;
    }
    if (gesture.kind === "parcel" && gesture.settings) {
      const old = this.state;
      if (old.kind !== "populate" || !old.candidate || !this.available())
        return;
      this.publish({
        ...old,
        pointer: structuredClone(gesture),
        rollbackIntent: structuredClone(old.candidate.intent),
      });
      return;
    }
    if (gesture.kind === "newNode") {
      this.beginDraft(gesture.draft, gesture, rollback);
      return;
    }
    const queued =
      gesture.kind === "roomMove" ||
      gesture.kind === "interiorRectangle" ||
      gesture.kind === "stairs";
    const version = this.available(queued);
    if (!version) return;
    const id = ++this.nextWorkflow,
      common = this.common(id, version);
    if (queued) {
      this.publish({
        ...common,
        kind: "queuedGesture",
        owner: gesture.house.id,
        inspection: null,
        pointer: structuredClone(gesture),
      });
      return;
    }
    const pointer = structuredClone(gesture);
    const captured = captureGestureOperation(gesture, this.source(version));
    if (!captured.ok) {
      this.ports.error(captured.message);
      return;
    }
    const operation = captured.operation;
    if (
      operation.kind === "createHouse" &&
      operation.parcelId &&
      pointer.kind === "houseRectangle"
    ) {
      const request = ++this.nextRequest;
      this.publish({
        ...common,
        kind: "geometry",
        operation,
        pointer,
        rollback: null,
        candidate: null,
        stage: {
          phase: "resolveParcelOwner",
          version: { sessionId: version.sessionId, revision: version.revision },
          request,
          resolved: false,
        },
      });
      const target = operation.parcelId;
      const owned = () => {
        const s = this.state;
        return (
          isOwner(s) &&
          this.ownsLifetime(id, version.sessionId, common.context) &&
          s.stage.request === request &&
          this.ownsReadVersion(version)
        );
      };
      void ownedEffect(owned, () =>
        this.ports.read(target, version, owned),
      ).then((result) => {
        if (result.kind === "obsolete" || !owned()) return;
        if (result.kind === "error") {
          this.fail(result.message);
          return;
        }
        const scene = result.value,
          s = this.state;
        if (!isOwner(s)) return;
        try {
          if (
            !sameVersion(this.ports.gate().version, version) ||
            !sameVersion(scene?.status, version)
          )
            throw Error("Dokumentstand geändert. Bitte erneut zeichnen.");
          if (
            !scene?.selectionState.exists ||
            scene.selectionState.parcelId !== target
          )
            throw Error("Parzelle existiert nicht mehr");
          if (scene.selectionState.houseId)
            throw Error(
              "Parzelle bereits bebaut – Räume im vorhandenen Haus ergänzen",
            );
          this.publish({ ...s, stage: { ...s.stage, resolved: true } });
        } catch (error) {
          if (owned()) {
            this.fail(String(error));
          }
        }
      });
    } else
      this.publish(
        geometryState(
          {
            ...common,
            basis: { sessionId: version.sessionId, revision: version.revision },
            kind: "geometry",
            candidate: null,
            stage: { phase: "editing" },
            rollback: null,
          },
          operation,
          pointer,
        ),
      );
  };
  evaluate = (result: Evaluation, finish: boolean) => {
    const s = this.state,
      g = workflowPointer(s);
    if (!g || g.pointer !== result.gesture.pointer) return;
    if (g.kind === "pan") {
      if (finish) this.dispatch({ type: "pan", gesture: null });
      return;
    }
    if (result.error) this.ports.error(result.error);
    if (
      this.ports.terrain &&
      g.kind === "terrain" &&
      !g.water &&
      result.intent?.type === "terrainStroke"
    ) {
      this.ports.terrain.append(result.intent.brush.points, result.intent.view);
      if (finish) this.ports.terrain.finish();
      if (finish) this.dispatch({ type: "cancel" });
      else if (s.kind === "geometry" && isExact(s))
        this.dispatch({
          type: "begin",
          state: geometryState(s, s.operation, result.gesture),
        });
      return;
    }
    if (s.kind === "queuedGesture") {
      if (!finish) {
        const gate = this.ports.gate();
        const version = gate.version;
        if (
          s.inspection &&
          result.intent &&
          this.ownsReadVersion(s.inspection.request.candidate.version) &&
          JSON.stringify(s.inspection.intent) === JSON.stringify(result.intent)
        ) {
          this.dispatch({
            type: "begin",
            state: {
              ...s,
              pointer: result.gesture as typeof s.pointer,
              guide: result.guide,
            },
          });
          return;
        }
        this.stopCheck();
        const request =
          result.intent && version && this.ownsReadVersion(version)
            ? this.request(this.token(s.id, version))
            : null;
        this.dispatch({
          type: "begin",
          state: {
            ...s,
            pointer: result.gesture as typeof s.pointer,
            guide: result.guide,
            inspection:
              request && result.intent
                ? {
                    request,
                    intent: structuredClone(result.intent),
                    preview: null,
                  }
                : null,
          },
        });
        if (request && result.intent) {
          const intent = structuredClone(result.intent);
          this.timer = setTimeout(() => this.inspect(request, intent), 100);
        }
      } else {
        this.cancel();
        if (
          result.intent &&
          isQueueIntent(result.intent) &&
          !result.error &&
          this.available(true)
        )
          void this.ports.queue(structuredClone(result.intent));
      }
      return;
    }
    if (s.kind === "populate") {
      if (
        result.intent?.type !== "populate" ||
        result.gesture.kind !== "parcel" ||
        s.stage.phase === "stale"
      )
        return;
      this.publish({
        ...s,
        pointer: finish ? null : result.gesture,
        candidate: this.candidate(s.id, result.intent, s.basis, false),
        stage: { phase: "editing" },
        rollbackIntent: finish ? undefined : s.rollbackIntent,
      });
      return;
    }
    if (s.kind !== "draft" && s.kind !== "geometry") return;
    const version = isOwner(s) ? s.stage.version : s.basis;
    if (!version) return;
    if (isExact(s) && s.stage.phase === "stale") {
      this.fail("Vorschau veraltet. Bitte neue Aktion beginnen.");
      return;
    }
    const intent = result.intent as ExactIntent | null;
    const captured =
      s.kind === "draft" && result.draft
        ? captureDraftOperation(result.draft, this.source(version), s.operation)
        : intent
          ? isOwner(s) && g.kind === "houseRectangle"
            ? captureHouseDrawingOperation(intent, g)
            : captureOperation(
                intent,
                this.source(version),
                result.draft ?? null,
              )
          : { ok: true as const, operation: s.operation };
    if (!captured.ok) {
      this.fail(captured.message);
      return;
    }
    const operation = captured.operation;
    if (operation.kind === "populate" || operation.kind === "delete") return;
    const candidate = intent
      ? this.candidate(
          s.id,
          intent,
          version,
          finish && s.kind !== "draft" && operation.kind !== "river",
        )
      : null;
    const pointer = finish
      ? null
      : (result.gesture as Exclude<Gesture, { kind: "pan" }>);
    if (isOwner(s)) {
      if (
        operation.kind !== "createHouse" ||
        (pointer && pointer.kind !== "houseRectangle")
      )
        return;
      this.publish({
        ...s,
        operation,
        pointer,
        candidate,
        guide: result.guide,
      });
    } else if (s.kind === "draft") {
      if (
        operation.kind !== "newRoad" &&
        operation.kind !== "extendRoad" &&
        operation.kind !== "newArea"
      )
        return;
      this.publish(
        draftState(
          {
            ...s,
            candidate,
            guide: result.guide,
            stage: { phase: "editing" },
            rollback: finish ? null : s.rollback,
          },
          operation,
          pointer,
        ),
      );
    } else {
      if (
        operation.kind === "newRoad" ||
        operation.kind === "extendRoad" ||
        operation.kind === "newArea"
      )
        return;
      if (finish && !candidate) this.cancel();
      else
        this.publish(
          geometryState(
            {
              ...s,
              candidate,
              guide: result.guide,
              stage: { phase: "editing" },
            },
            operation,
            pointer,
          ),
          finish,
        );
    }
  };
  abortPointer = (pointer?: number) => {
    if (pointer === undefined && isOwner(this.state) && !this.state.pointer) {
      this.cancel();
      return;
    }
    const s = this.state,
      g = workflowPointer(s);
    if (!g || (pointer !== undefined && g.pointer !== pointer)) return;
    if (g.kind === "pan") {
      this.dispatch({ type: "pan", gesture: null });
      return;
    }
    if (s.kind === "populate" && s.rollbackIntent)
      void this.beginIntent(s.rollbackIntent, false);
    else if (s.kind === "draft" && s.rollback) this.beginDraft(s.rollback);
    else this.cancel();
  };
  private check(candidate: Candidate) {
    const s = this.state,
      version = candidate.token.version;
    if (
      !this.live ||
      !isExact(s) ||
      !sameCandidate(s.candidate?.token, candidate.token) ||
      s.stage.phase === "stale" ||
      !this.ownsReadVersion(version)
    )
      return;
    const request = this.request(candidate.token);
    this.dispatch({ type: "checking", request });
    this.inspect(request, candidate.intent);
  }
  private inspect(request: RequestToken, intent: Intent) {
    void ownedEffect(
      () => this.ownsRequest(request),
      () =>
        this.ports.inspect(
          { operationId: request.candidate.candidateId, intent },
          request.candidate.version,
        ),
    ).then((result) => {
      if (result.kind === "obsolete" || !this.ownsRequest(request)) return;
      const queued = this.state.kind === "queuedGesture";
      if (result.kind === "error" || !result.value) {
        if (queued) {
          if (result.kind === "error") this.ports.error(result.message);
        } else {
          this.dispatch({
            type: "failure",
            request,
            message:
              result.kind === "error"
                ? result.message
                : "Vorschau konnte nicht geprüft werden. Bitte erneut prüfen.",
          });
        }
        return;
      }
      const deleting = this.state.kind === "delete",
        preview = result.value;
      this.dispatch({
        type: queued ? "queuePreview" : "preview",
        request,
        preview,
      });
      if (
        deleting &&
        preview.valid &&
        !preview.changed &&
        this.state.kind === "idle"
      )
        this.ports.error("Bereits entfernt.");
    });
  }

  canAccept = () => {
    const s = this.state;
    return (
      canAcceptWorkflow(s) &&
      this.live &&
      this.ownsReadVersion(s.candidate.token.version)
    );
  };
  accept = async (deletion = false) => {
    const s = this.state;
    if (
      !canAcceptWorkflow(s) ||
      !this.canAccept() ||
      (s.kind === "delete") !== deletion
    )
      return;
    const candidate = s.candidate;
    this.stopCheck();
    this.dispatch({ type: "accept", deletion });
    const mayComplete = () =>
      isExact(this.state) &&
      this.ownsLifetime(s.id, s.sessionId, s.context) &&
      this.state.stage.phase === "committing" &&
      sameCandidate(this.state.candidate?.token, candidate.token);
    const mayDispatch = () =>
      mayComplete() &&
      sameVersion(this.ports.gate().version, candidate.token.version);
    const result = await ownedEffect(
      mayDispatch,
      () =>
        this.ports.commitExact(
          {
            operationId: candidate.token.candidateId,
            intent: candidate.intent,
          },
          candidate.token.version,
          mayDispatch,
        ),
      mayComplete,
    );
    if (result.kind === "obsolete" || !mayComplete()) return;
    if (
      result.kind === "error" &&
      result.error instanceof WireError &&
      result.error.category === "invalidInput"
    ) {
      // A rejected edit remains available for correction; it is never retried.
      this.dispatch({
        type: "commitRejected",
        candidate: candidate.token,
        message: result.message,
        issue: result.error.issue,
      });
    } else {
      this.cancel();
      if (result.kind === "error") this.ports.error(result.message);
      else if (result.value)
        this.ports.completed(candidate.intent, result.value);
    }
  };

  sync = () => {
    if (!this.live) return;
    const gate = this.ports.gate(),
      wasExclusive = this.wasExclusive;
    this.wasExclusive = gate.exclusive;
    const s = this.state;
    if (s.kind !== "idle") {
      if (
        !gate.version ||
        s.sessionId !== gate.version.sessionId ||
        s.context !== this.ports.context() ||
        gate.uncertain
      ) {
        this.cancel();
        return;
      }
      const pointer = workflowPointer(s);
      if (this.ports.terrain && pointer?.kind === "terrain" && !pointer.water) {
        if (gate.exclusive) this.cancel();
        return;
      }
      if (
        isExact(s) &&
        s.stage.phase !== "committing" &&
        (gate.exclusive || !sameVersion(s.basis, gate.version))
      ) {
        this.stopCheck();
        this.dispatch({
          type: "stale",
          message: "Dokumentstand geändert. Vorschau erneut prüfen.",
        });
      } else if (
        isOwner(s) &&
        (gate.exclusive || !sameVersion(s.stage.version, gate.version))
      ) {
        this.fail("Dokumentstand geändert. Bitte erneut zeichnen.");
      } else if (s.kind === "queuedGesture" && gate.exclusive) this.cancel();
      else if (
        s.kind === "queuedGesture" &&
        s.inspection &&
        !sameVersion(s.inspection.request.candidate.version, gate.version)
      ) {
        this.stopCheck();
        this.dispatch({ type: "clearInspection" });
      }
    }
    if (wasExclusive && !gate.exclusive && isExact(this.state))
      this.dispatch({
        type: "stale",
        message: "Dateivorgang beendet. Vorschau erneut prüfen.",
      });
  };
  recheck = async () => {
    const s = this.state,
      version = this.available();
    if (!version || !canRecheckWorkflow(s)) return;
    const freshCandidate = this.candidate(
      s.id,
      s.candidate.intent,
      version,
      false,
    );
    const request = this.request(freshCandidate.token),
      id = s.id;
    this.stopCheck();
    this.dispatch({ type: "refresh", candidate: freshCandidate, request });
    const owned = () => this.ownsRequest(request);
    const target = operationTarget(s.operation);
    const result = target
      ? await ownedEffect(owned, () => this.ports.read(target, version, owned))
      : { kind: "value" as const, value: undefined };
    if (result.kind === "obsolete" || !owned()) return;
    if (result.kind === "error") {
      this.fail(result.message);
      return;
    }
    if (target && !sameVersion(result.value?.status, version)) {
      this.fail(
        "Aktueller Header konnte nicht gelesen werden. Bitte neue Aktion beginnen.",
      );
      return;
    }
    const checked = recheckOperation(
      s.operation,
      s.candidate,
      s.guide,
      result.value,
    );
    if (checked.kind !== "ready") {
      this.fail(checked.message);
      return;
    }
    const candidate = this.candidate(
      id,
      checked.intent,
      version,
      false,
      s.kind === "geometry",
    );
    this.publish(
      transition(this.state, {
        type: "refreshed",
        request,
        candidate,
        guide: checked.guide,
      }),
      true,
    );
  };
}
