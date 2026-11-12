import { useEffect, useRef, useState } from "react";
import type { PreviewBuild, PreviewUpdateState } from "./preview-updates";

const buildLabel = (build: PreviewBuild) =>
  `${build.version}${build.revision ? ` · Build ${build.revision}` : " · lokaler Build"}`;

const megabytes = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;

export function PreviewUpdates() {
  const [state, setState] = useState<PreviewUpdateState | null>(null);
  const [opened, setOpened] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(false);
  const pendingCall = useRef(false);
  const events = useRef(0);
  const bridge = window.atlasUpdates;

  useEffect(() => {
    if (!bridge) return;
    active.current = true;
    // Subscribe before the initial read; a delayed read must never overwrite a
    // newer download or installation event.
    const unsubscribe = bridge.onStatus((next) => {
      events.current++;
      setState(next);
    });
    const before = events.current;
    void bridge.status().then(
      (next) => {
        if (active.current && events.current === before) setState(next);
      },
      (reason: unknown) => {
        if (active.current && events.current === before)
          setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
    return () => {
      active.current = false;
      unsubscribe();
    };
  }, [bridge]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (opened && !element.open) element.showModal();
    else if (!opened && element.open) element.close();
  }, [opened]);

  const invoke = async (
    operation: () => Promise<PreviewUpdateState | void>,
  ) => {
    if (pendingCall.current) return;
    pendingCall.current = true;
    setPending(true);
    setError(null);
    const before = events.current;
    try {
      const next = await operation();
      if (active.current && next && events.current === before) setState(next);
    } catch (reason) {
      if (active.current)
        setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      pendingCall.current = false;
      if (active.current) setPending(false);
    }
  };

  const busy =
    pending ||
    state?.status === "checking" ||
    state?.status === "downloading" ||
    state?.status === "installing";
  const newer = Boolean(state?.available);
  const needsRestart =
    state?.status === "installed" || state?.status === "restart-required";
  const needsAttention = newer || needsRestart;
  const buttonLabel = needsRestart
    ? "Neustart nötig"
    : state?.downloaded
      ? "Update bereit"
      : newer
        ? "Update verfügbar"
        : "Updates";
  const percentage =
    state && state.totalBytes > 0
      ? Math.min(
          100,
          Math.round((100 * state.downloadedBytes) / state.totalBytes),
        )
      : null;

  return (
    <>
      <button
        className={`preview-update-button${needsAttention ? " has-update" : ""}`}
        aria-haspopup="dialog"
        disabled={!bridge}
        onClick={() => setOpened(true)}
      >
        {needsAttention && <span aria-hidden="true">●</span>}
        {buttonLabel}
      </button>
      <dialog
        ref={dialog}
        className="preview-update-dialog"
        aria-labelledby="preview-update-title"
        onClose={() => setOpened(false)}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="preview-update-heading">
          <div>
            <p className="eyebrow">ATLAS-VORSCHAU · PR #1469</p>
            <h2 id="preview-update-title">Updates</h2>
          </div>
          <button onClick={() => setOpened(false)}>Schließen</button>
        </div>
        <dl className="preview-update-builds">
          <dt>Aktueller App-Stand</dt>
          <dd>
            {state ? buildLabel(state.current) : "Wird gelesen …"}
            {state?.current.commit && (
              <code>{state.current.commit.slice(0, 7)}</code>
            )}
          </dd>
          {state?.available && (
            <>
              <dt>Verfügbarer Stand</dt>
              <dd>
                {buildLabel(state.available)}
                <code>{state.available.commit.slice(0, 7)}</code>
              </dd>
            </>
          )}
        </dl>
        <p className="preview-update-message" role="status">
          {state?.message ?? "Der aktuelle Updatestatus wird geladen."}
        </p>
        {state?.status === "downloading" && (
          <div className="preview-update-progress">
            <progress
              aria-label="Update herunterladen"
              max={100}
              value={percentage ?? undefined}
            />
            <span>
              {megabytes(state.downloadedBytes)}
              {state.totalBytes > 0 &&
                ` von ${megabytes(state.totalBytes)} · ${percentage} %`}
            </span>
          </div>
        )}
        {state?.status === "installing" && (
          <p className="preview-update-hint">
            Bitte die Systemabfrage bestätigen. Die Installation kann einen
            Moment dauern.
          </p>
        )}
        {error && (
          <p className="preview-update-error" role="alert">
            {error}
          </p>
        )}
        <div className="preview-update-actions">
          {!needsRestart && (
            <button
              disabled={busy || !state || state.status === "unsupported"}
              onClick={() => void invoke(() => bridge.check())}
            >
              Nach Updates suchen
            </button>
          )}
          {newer && !state?.downloaded && !needsRestart && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void invoke(() => bridge.download())}
            >
              Herunterladen
            </button>
          )}
          {state?.downloaded && state.canInstall && !needsRestart && (
            <button
              className="primary"
              disabled={busy || !state.canInstall}
              onClick={() => void invoke(() => bridge.install())}
            >
              Installieren und neu starten
            </button>
          )}
          {needsRestart && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void invoke(() => bridge.restart())}
            >
              Jetzt neu starten
            </button>
          )}
          <button
            disabled={pending}
            onClick={() => void invoke(() => bridge.openRelease())}
          >
            GitHub-Release öffnen
          </button>
        </div>
        <p className="preview-update-hint">
          Herunterladen und Installieren starten erst nach deinem Klick. Vor der
          Installation kannst du ungespeicherte Änderungen sichern. Danach
          startet die App mit dem neuen Stand neu.
        </p>
      </dialog>
    </>
  );
}
