import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorController, type EditorState } from "./EditorController";
import {
  EditorHeader,
  EditorStatus,
  MapNavigation,
  ToolRail,
  type EditorAction,
} from "./EditorChrome";
import { SurfacePanel, ToolSettings } from "./EditorPanels";
import type { Point } from "./model";
import type { ObservationOptions } from "./observation";
import "./editor.css";

declare global {
  interface Window {
    /** Read-only lab observation; ordinary input and the real file path do the work. */
    atlasObserve?: (
      points?: Point[],
      options?: ObservationOptions,
    ) => ReturnType<EditorController["observe"]>;
    atlasContentProbes?: EditorController["configureContentProbes"];
  }
}

function Atlas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<EditorController | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const diagnostics = window.atlasDesktop?.diagnostics ?? false;

  useEffect(() => {
    if (!canvas.current) return;
    if (!window.atlasDesktop) {
      setStartupError(
        "Dieser Editor benötigt den Desktopstart mit Speicheranbindung.",
      );
      return;
    }
    const editor = new EditorController(canvas.current, window.atlasDesktop);
    controller.current = editor;
    editor.onChange = setState;
    void editor
      .init()
      .then(() => {
        if (diagnostics) {
          window.atlasObserve = (points, options) =>
            editor.observe(points, options);
          window.atlasContentProbes = (probes) =>
            editor.configureContentProbes(probes);
        }
      })
      .catch((e: unknown) => setStartupError(String(e)));
    return () => {
      delete window.atlasObserve;
      delete window.atlasContentProbes;
      editor.destroy();
    };
  }, []);

  const action: EditorAction = (operation) => {
    const editor = controller.current;
    if (!editor) return;
    editor.run(() => operation(editor));
  };

  return (
    <main className="atlas-shell">
      <EditorHeader state={state} action={action} />
      <ToolRail
        state={state}
        onMode={(mode) => action((editor) => editor.setMode(mode))}
      />
      {/* Keep this canvas and its immediate parent mounted across all panel changes. */}
      <section className="atlas-map" aria-label="Weltkarte">
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label="Geländekarte"
          aria-busy={state?.loading ?? true}
          className={state?.loading ? "waiting" : ""}
        />
        <div className="atlas-map-title">
          Atlas · {state?.title ?? "Neue Karte"}
        </div>
        <details className="atlas-map-help">
          <summary>Hilfe</summary>
          <p>
            Mausrad: Zoom · Mittlere Maustaste: Verschieben · Strg+Z: Rückgängig
          </p>
          <p>
            Werkzeug links wählen. Die zugehörigen Einstellungen und
            Eigenschaften stehen rechts.
          </p>
        </details>
        {(startupError || state?.persistenceError || state?.error) && (
          <div className="error-banner" role="alert">
            <span>
              {startupError || state?.persistenceError || state?.error}
              {state?.persistenceError && (
                <small>
                  Die Änderungen bleiben im Editor erhalten. Speicherstand
                  prüfen oder bei Neu, Öffnen beziehungsweise Schließen
                  ausdrücklich verwerfen.
                </small>
              )}
            </span>
            {!startupError && state?.persistenceError && (
              <button
                disabled={state?.recovering || state?.fileAction}
                onClick={() => action((e) => e.recoverWrites())}
              >
                {state?.recovering
                  ? "Speicherstand wird geprüft …"
                  : "Speicherstand prüfen"}
              </button>
            )}
            {!startupError && !state?.persistenceError && state?.loading && (
              <button onClick={() => action((e) => e.retryLoad())}>
                Erneut laden
              </button>
            )}
          </div>
        )}
        <MapNavigation state={state} action={action} />
      </section>
      <aside className="atlas-panel" aria-label="Eigenschaften">
        <div className="atlas-panel-content">
          <ToolSettings state={state} action={action} />
          <SurfacePanel state={state} action={action} />
          {diagnostics && (
            <section className="experiment" aria-label="Belastungsprüfung">
              <p className="eyebrow">BELASTUNGSPRÜFUNG</p>
              <button
                disabled={state?.background}
                onClick={() => action((e) => e.background())}
              >
                {state?.background
                  ? "Berechnung läuft …"
                  : "Hintergrundarbeit starten"}
              </button>
              <p className="hint">
                Währenddessen navigieren, malen und speichern.
              </p>
            </section>
          )}
        </div>
      </aside>
      <EditorStatus state={state} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Atlas />);
