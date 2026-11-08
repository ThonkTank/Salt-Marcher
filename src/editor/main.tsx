import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorController, type EditorState } from "./EditorController";
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
  }
}

function Atlas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<EditorController | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [diameterDraft, setDiameterDraft] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const mode = state?.mode ?? "raise";
  const diameter = state?.diameter ?? 80;
  const amount = state?.amount ?? 20;
  const diagnostics = window.atlasDesktop?.diagnostics ?? false;

  useEffect(() => {
    if (!canvas.current) return;
    if (!window.atlasDesktop) {
      setStartupError(
        "Diese Geländestudie benötigt den Desktopstart mit Speicheranbindung.",
      );
      return;
    }
    const editor = new EditorController(canvas.current, window.atlasDesktop);
    controller.current = editor;
    editor.onChange = setState;
    void editor
      .init()
      .then(() => {
        if (diagnostics)
          window.atlasObserve = (points, options) =>
            editor.observe(points, options);
      })
      .catch((e: unknown) => setStartupError(String(e)));
    return () => {
      delete window.atlasObserve;
      editor.destroy();
    };
  }, []);

  const action = (
    operation: (editor: EditorController) => void | Promise<void>,
  ) => {
    const editor = controller.current;
    if (!editor) return;
    editor.run(() => operation(editor));
  };
  const selectMode = (next: "raise" | "lower" | "pan") => {
    action((editor) => editor.setMode(next));
  };
  const navigate = (event: Event, scale: number) =>
    action((editor) =>
      editor.goTo(event, Number(x) / 0.3048, Number(y) / 0.3048, scale),
    );

  return (
    <main className="atlas-shell">
      <header className="atlas-header">
        <div className="atlas-brand">
          <span className="brand-mark">✧</span>
          <div>
            <strong>ATLAS</strong>
            <span>Geländestudie</span>
          </div>
        </div>
        <div className="project-label">
          {state?.title ?? "Projekt öffnen"}
          <span className={`save-indicator ${state?.saved ? "saved" : ""}`}>
            {state?.writing
              ? "Arbeitskopie wird gesichert"
              : state?.saved
                ? "Datei gespeichert"
                : "Ungespeicherte Änderungen"}
          </span>
        </div>
        <nav aria-label="Datei">
          <button
            disabled={state?.fileAction || state?.recovering}
            onClick={() => action((e) => e.newProject())}
          >
            Neu
          </button>
          <button
            disabled={state?.fileAction || state?.recovering}
            onClick={() => action((e) => e.open())}
          >
            Öffnen
          </button>
          <button
            disabled={state?.fileAction || state?.recovering}
            className="primary"
            onClick={() => action((e) => e.save())}
          >
            Speichern
          </button>
          <button
            aria-label="Speichern unter"
            disabled={state?.fileAction || state?.recovering}
            onClick={() => action((e) => e.save(true))}
          >
            …
          </button>
        </nav>
      </header>
      <aside className="atlas-panel">
        <p className="eyebrow">WERKZEUGE</p>
        <h1>Gelände formen</h1>
        <p className="intro">
          Große Formen anlegen.
          <br />
          Feine Details erhalten.
        </p>
        <div className="tool-list">
          <button
            aria-pressed={mode === "raise"}
            onClick={() => selectMode("raise")}
          >
            <span>↗</span>Anheben
          </button>
          <button
            aria-pressed={mode === "lower"}
            onClick={() => selectMode("lower")}
          >
            <span>↘</span>Absenken
          </button>
          <button
            aria-pressed={mode === "pan"}
            onClick={() => selectMode("pan")}
          >
            <span>✥</span>Verschieben
          </button>
        </div>
        <div className="field">
          <label htmlFor="diameter">
            Pinselgröße <span>px</span>
          </label>
          <input
            id="diameter"
            aria-label="Pinselgröße"
            type="number"
            min="8"
            max="512"
            value={diameterDraft ?? diameter}
            onChange={(e) => {
              setDiameterDraft(e.target.value);
            }}
            onBlur={() => {
              if (diameterDraft !== null && diameterDraft.trim() !== "")
                action((editor) =>
                  editor.setBrush(Number(diameterDraft), editor.amount),
                );
              setDiameterDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="amount">
            Pinselstärke <span>m/s</span>
          </label>
          <input
            id="amount"
            aria-label="Pinselstärke"
            type="number"
            min="0.03048"
            max="3048"
            step="1"
            value={amountDraft ?? +(amount * 0.3048).toFixed(3)}
            onChange={(e) => {
              setAmountDraft(e.target.value);
            }}
            onBlur={() => {
              if (amountDraft !== null && amountDraft.trim() !== "")
                action((editor) =>
                  editor.setBrush(
                    editor.diameter,
                    Number(amountDraft) / 0.3048,
                  ),
                );
              setAmountDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </div>
        <div className="history">
          <button
            disabled={!state?.canUndo}
            onClick={() => action((e) => e.undo())}
          >
            ↶ Rückgängig
          </button>
          <button
            disabled={!state?.canRedo}
            onClick={() => action((e) => e.redo())}
          >
            ↷ Wiederholen
          </button>
        </div>
        <hr />
        <p className="eyebrow">ANSICHT</p>
        <div className="view-buttons">
          <button onClick={(e) => navigate(e.nativeEvent, 0.25)}>
            Nahansicht
          </button>
          <button onClick={(e) => navigate(e.nativeEvent, 0.025)}>
            Regionsansicht
          </button>
          <button onClick={(e) => navigate(e.nativeEvent, 0.000002)}>
            Weltansicht
          </button>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={state?.grid ?? true}
            onChange={(e) => {
              action((editor) => editor.setGrid(e.target.checked));
            }}
          />
          Raster anzeigen
        </label>
        <details>
          <summary>Zu Koordinaten</summary>
          <div className="coordinates">
            <label>
              X (m)
              <input
                aria-label="Ziel X"
                type="number"
                value={x}
                onChange={(e) => setX(e.target.value)}
              />
            </label>
            <label>
              Y (m)
              <input
                aria-label="Ziel Y"
                type="number"
                value={y}
                onChange={(e) => setY(e.target.value)}
              />
            </label>
          </div>
          <button
            onClick={(e) => navigate(e.nativeEvent, state?.scale ?? 0.25)}
          >
            Zum Ziel
          </button>
        </details>
        {diagnostics && (
          <div className="experiment">
            <p className="eyebrow">BELASTUNGSPRÜFUNG</p>
            <button
              disabled={state?.background}
              onClick={() => action((e) => e.background())}
            >
              {state?.background
                ? "Berechnung läuft …"
                : "Hintergrundarbeit starten"}
            </button>
            <p>Währenddessen navigieren, malen und speichern.</p>
          </div>
        )}
        <p className="hint">
          Mausrad: Zoom · Mittlere Maustaste: Verschieben · Strg+Z: Rückgängig
        </p>
      </aside>
      <section className="atlas-map" aria-label="Weltkarte">
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label="Geländekarte"
          aria-busy={state?.loading ?? true}
          className={state?.loading ? "waiting" : ""}
        />
        <div className="map-label">
          <span>GELÄNDESTUDIE</span>
          <strong>Vom Detail zur Region</strong>
        </div>
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
        <footer className="map-status">
          <span
            role="status"
            className={state?.loading || state?.needsPress ? "loading" : ""}
          >
            {state?.message ?? "Editor startet …"}
          </span>
          <span>
            {state
              ? `${(5 * 2 ** state.level * 0.3048).toLocaleString("de-DE", { maximumFractionDigits: 2 })} m · Höhenraster`
              : ""}
          </span>
        </footer>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Atlas />);
