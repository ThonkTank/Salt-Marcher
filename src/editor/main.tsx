import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorController, type EditorState } from "./EditorController";
import type { Point } from "./model";
import "./editor.css";

declare global {
  interface Window {
    /** Read-only lab observation; ordinary input and the real file path do the work. */
    atlasObserve?: (
      points?: Point[],
    ) => ReturnType<EditorController["observe"]>;
  }
}

function Atlas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<EditorController | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState("raise");
  const [diameter, setDiameter] = useState(80);
  const [amount, setAmount] = useState(20);
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const [grid, setGrid] = useState(true);

  useEffect(() => {
    if (!canvas.current) return;
    if (!window.atlasDesktop) {
      setError(
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
        window.atlasObserve = (points) => editor.observe(points);
      })
      .catch((e: unknown) => setError(String(e)));
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
    setError(null);
    try {
      void Promise.resolve(operation(editor)).catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const selectMode = (next: "raise" | "lower" | "pan") => {
    setMode(next);
    action((editor) => {
      editor.mode = next;
    });
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
          <button onClick={() => action((e) => e.newProject())}>Neu</button>
          <button onClick={() => action((e) => e.open())}>Öffnen</button>
          <button className="primary" onClick={() => action((e) => e.save())}>
            Speichern
          </button>
          <button
            aria-label="Speichern unter"
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
            value={diameter}
            onChange={(e) => {
              const value = Number(e.target.value);
              setDiameter(value);
              action((editor) => editor.setBrush(value, amount));
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="amount">
            Höhenänderung <span>m</span>
          </label>
          <input
            id="amount"
            aria-label="Höhenänderung"
            type="number"
            min="0.03048"
            max="3048"
            step="1"
            value={+(amount * 0.3048).toFixed(3)}
            onChange={(e) => {
              const value = Number(e.target.value) / 0.3048;
              setAmount(value);
              action((editor) => editor.setBrush(diameter, value));
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
            checked={grid}
            onChange={(e) => {
              setGrid(e.target.checked);
              action((editor) => {
                editor.world.grid = e.target.checked;
                editor.world.redraw();
              });
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
        <p className="hint">
          Mausrad: Zoom · Mittlere Maustaste: Verschieben · Strg+Z: Rückgängig
        </p>
      </aside>
      <section className="atlas-map" aria-label="Weltkarte">
        <canvas ref={canvas} tabIndex={0} aria-label="Geländekarte" />
        <div className="map-label">
          <span>GELÄNDESTUDIE</span>
          <strong>Vom Detail zur Region</strong>
        </div>
        {(error || state?.error) && (
          <div className="error-banner" role="alert">
            {error || state?.error}
          </div>
        )}
        <footer className="map-status">
          <span className={state?.loading ? "loading" : ""}>
            {state?.loading
              ? "Ausschnitt wird geladen …"
              : (state?.message ?? "Editor startet …")}
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
