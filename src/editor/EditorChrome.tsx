import { useState } from "react";
import type { EditorController, EditorState } from "./EditorController";
import { PreviewUpdates } from "./PreviewUpdates";

export type EditorAction = (
  operation: (editor: EditorController) => void | Promise<void>,
) => void;
export const landscapeNames = ["Wald", "Buschland", "Wiese", "Felsgebiet"];

export function EditorHeader({
  state,
  action,
}: {
  state: EditorState | null;
  action: EditorAction;
}) {
  const unavailable = !state || state.fileAction || state.recovering;
  return (
    <header className="atlas-header">
      <strong className="atlas-brand">
        SaltMarcher <small>ATLAS · VORSCHAU</small>
      </strong>
      <nav aria-label="Datei">
        <button
          disabled={unavailable}
          onClick={() => action((e) => e.newProject())}
        >
          Neu
        </button>
        <button disabled={unavailable} onClick={() => action((e) => e.open())}>
          Öffnen
        </button>
        <button disabled={unavailable} onClick={() => action((e) => e.save())}>
          Speichern
        </button>
        <button
          disabled={unavailable}
          onClick={() => action((e) => e.save(true))}
        >
          Speichern unter
        </button>
      </nav>
      <div className="project-label" title={state?.title}>
        {state && !state.saved && <span aria-hidden="true">● </span>}
        {state?.title ?? "Projekt öffnen"}
        <span className={`save-indicator ${state?.saved ? "saved" : ""}`}>
          {!state
            ? "Editor startet …"
            : state.writing
              ? "Arbeitskopie wird gesichert"
              : state.saved
                ? "Datei gespeichert"
                : "Ungespeicherte Änderungen"}
        </span>
      </div>
      <nav className="history" aria-label="Verlauf">
        <button
          disabled={unavailable || !state?.canUndo}
          onClick={() => action((e) => e.undo())}
        >
          ↶ Rückgängig
        </button>
        <button
          disabled={unavailable || !state?.canRedo}
          onClick={() => action((e) => e.redo())}
        >
          ↷ Wiederholen
        </button>
      </nav>
      <PreviewUpdates />
    </header>
  );
}

const unavailableTools = [
  ["↝", "Straße"],
  ["≋", "Fluss"],
  ["≈", "Gewässer"],
  ["▧", "Boden"],
  ["⚑", "Regionen"],
] as const;
const interiorTools = [
  ["▱", "Raum"],
  ["⌫", "Radieren"],
  ["⇥", "Zuweisen"],
  ["⊓", "Tür"],
  ["▥", "Treppe"],
] as const;

export function ToolRail({
  state,
  onMode,
}: {
  state: EditorState | null;
  onMode: (mode: EditorState["mode"]) => void;
}) {
  const modeButton = (
    mode: EditorState["mode"],
    icon: string,
    label: string,
  ) => (
    <button
      key={mode}
      disabled={!state || state.fileAction || state.recovering}
      aria-pressed={state?.mode === mode}
      onClick={() => onMode(mode)}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
  const unavailableButton = ([icon, label]: readonly [string, string]) => (
    <button
      key={label}
      disabled
      title="Im neuen Editor noch nicht verfügbar"
      aria-describedby="unavailable-tools-note"
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
  return (
    <aside className="atlas-tools tool-list" aria-label="Werkzeuge">
      <p className="eyebrow">WELT GESTALTEN</p>
      {modeButton("select", "↖", "Haus auswählen")}
      <div className="tool-group" role="group" aria-label="Höhen">
        <h2>Höhen</h2>
        {modeButton("raise", "↗", "Anheben")}
        {modeButton("lower", "↘", "Absenken")}
      </div>
      <div
        className="tool-group"
        role="group"
        aria-label="Landschaftswerkzeuge"
      >
        <h2>Landschaft</h2>
        {modeButton("forest", "♣", landscapeNames[state?.landscapeKind ?? 0])}
        {modeButton("clearing", "○", "Lichtung")}
      </div>
      {modeButton("house", "⌂", "Haus platzieren")}
      {modeButton("pan", "✥", "Verschieben")}
      <div
        className="tool-group"
        role="group"
        aria-label="Noch nicht verfügbare Werkzeuge"
      >
        <h2>Weitere Werkzeuge</h2>
        {unavailableTools.map(unavailableButton)}
      </div>
      <details className="interior-tools">
        <summary>Innenräume</summary>
        {interiorTools.map(unavailableButton)}
      </details>
      <p id="unavailable-tools-note" className="hint">
        Deaktivierte Werkzeuge sind noch nicht angebunden.
      </p>
    </aside>
  );
}

/** A display-only scale bar; the renderer remains the sole camera owner. */
export function displayScale(scale: number) {
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const target = (100 * 0.3048) / scale;
  if (!Number.isFinite(target) || target <= 0) return null;
  const power = 10 ** Math.floor(Math.log10(target));
  const metres =
    (target / power >= 5 ? 5 : target / power >= 2 ? 2 : 1) * power;
  return {
    pixels: (metres * scale) / 0.3048,
    label:
      metres >= 1000
        ? `${(metres / 1000).toLocaleString("de-DE", { maximumSignificantDigits: 3 })} km`
        : `${metres.toLocaleString("de-DE", { maximumSignificantDigits: 3 })} m`,
  };
}

export function MapNavigation({
  state,
  action,
}: {
  state: EditorState | null;
  action: EditorAction;
}) {
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const bar = state ? displayScale(state.scale) : null;
  const navigate = (event: Event, scale: number) =>
    action((editor) =>
      editor.goTo(event, Number(x) / 0.3048, Number(y) / 0.3048, scale),
    );
  return (
    <div className="atlas-navigation" aria-label="Kartenansicht" role="group">
      <div className="view-buttons">
        <button
          disabled={!state}
          onClick={(e) => navigate(e.nativeEvent, 0.25)}
        >
          Nahansicht
        </button>
        <button
          disabled={!state}
          onClick={(e) => navigate(e.nativeEvent, 0.025)}
        >
          Regionsansicht
        </button>
        <button
          disabled={!state}
          onClick={(e) => navigate(e.nativeEvent, 0.000002)}
        >
          Weltansicht
        </button>
        <button disabled title="Im neuen Editor noch nicht verfügbar">
          Einpassen
        </button>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={state?.grid ?? true}
          disabled={!state}
          onChange={(e) => action((editor) => editor.setGrid(e.target.checked))}
        />
        Raster anzeigen
      </label>
      <details className="coordinate-menu">
        <summary>Zu Koordinaten</summary>
        <div className="coordinate-popover">
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
            disabled={!state}
            onClick={(e) => navigate(e.nativeEvent, state?.scale ?? 0.25)}
          >
            Zum Ziel
          </button>
        </div>
      </details>
      {bar && (
        <span
          className="atlas-scale"
          aria-label={`Maßstabsleiste: ${bar.label}`}
        >
          <span style={{ width: bar.pixels }} />
          {bar.label}
        </span>
      )}
    </div>
  );
}

export function EditorStatus({ state }: { state: EditorState | null }) {
  const mode = state?.mode;
  const landscape = mode === "forest" || mode === "clearing";
  const house = mode === "house" || mode === "select";
  return (
    <footer className="atlas-status map-status">
      <span
        role="status"
        className={state?.loading || state?.needsPress ? "loading" : ""}
        title={state?.message}
      >
        {state?.message ?? "Editor startet …"}
      </span>
      <span className="grid-status">
        {state
          ? house
            ? state.selectedHouse
              ? "Haus ausgewählt"
              : "Häuser"
            : `${((landscape ? 1 : 5) * 2 ** state.level * 0.3048).toLocaleString("de-DE", { maximumFractionDigits: 2 })} m · ${landscape ? "Landschaftsraster" : "Höhenraster"}`
          : ""}
      </span>
    </footer>
  );
}
