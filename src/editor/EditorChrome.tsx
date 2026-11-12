import { useState } from "react";
import type { EditorController, EditorState } from "./EditorController";
import { PreviewUpdates } from "./PreviewUpdates";
import { EditorIcon, type EditorIconName } from "./EditorIcon";

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
          title="Rückgängig (Strg+Z)"
          onClick={() => action((e) => e.undo())}
        >
          <EditorIcon name="undo" /> Rückgängig
        </button>
        <button
          disabled={unavailable || !state?.canRedo}
          title="Wiederholen (Strg+Umschalt+Z)"
          onClick={() => action((e) => e.redo())}
        >
          <EditorIcon name="redo" /> Wiederholen
        </button>
      </nav>
      <PreviewUpdates />
    </header>
  );
}

const unavailableTools = [
  ["road", "Straße"],
  ["river", "Fluss"],
  ["water", "Gewässer"],
  ["ground", "Boden"],
  ["region", "Regionen"],
] as const;
const interiorTools = [
  ["room", "Raum"],
  ["erase", "Radieren"],
  ["assign", "Zuweisen"],
  ["door", "Tür"],
  ["stairs", "Treppe"],
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
    icon: EditorIconName,
    label: string,
    pressed = state?.mode === mode,
    shortLabel = label,
  ) => (
    <button
      key={mode}
      aria-label={label}
      title={label}
      disabled={!state || state.fileAction || state.recovering}
      aria-pressed={pressed}
      onClick={() => onMode(mode)}
    >
      <EditorIcon name={icon} />
      <span>{shortLabel}</span>
    </button>
  );
  const unavailableButton = ([icon, label]: readonly [
    EditorIconName,
    string,
  ]) => (
    <button
      key={label}
      disabled
      aria-label={label}
      title={`${label}: im neuen Editor noch nicht verfügbar`}
      aria-describedby="unavailable-tools-note"
    >
      <EditorIcon name={icon} />
      <span>{label}</span>
    </button>
  );
  return (
    <aside className="atlas-tools tool-list" aria-label="Werkzeuge">
      <p className="eyebrow">WELT GESTALTEN</p>
      {modeButton(
        "select",
        "select",
        "Haus auswählen",
        state?.mode === "select",
        "Auswahl",
      )}
      {modeButton(
        state?.heightMode ?? "raise",
        "height",
        "Höhen",
        state?.mode === "land" ||
          state?.mode === "sea" ||
          state?.mode === "raise" ||
          state?.mode === "lower",
      )}
      <div
        className="tool-group"
        role="group"
        aria-label="Landschaftswerkzeuge"
      >
        <h2>Landschaft</h2>
        {modeButton(
          "forest",
          "forest",
          landscapeNames[state?.landscapeKind ?? 0],
        )}
        {modeButton("clearing", "clearing", "Lichtung")}
      </div>
      {modeButton(
        "house",
        "house",
        "Haus platzieren",
        state?.mode === "house",
        "Haus",
      )}
      {modeButton("pan", "pan", "Verschieben")}
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
        Weitere Werkzeuge folgen.
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
          aria-pressed={state?.scale === 0.25}
          onClick={(e) =>
            action((editor) => editor.setViewScale(e.nativeEvent, 0.25))
          }
        >
          Nahansicht
        </button>
        <button
          disabled={!state}
          aria-pressed={state?.scale === 0.025}
          onClick={(e) =>
            action((editor) => editor.setViewScale(e.nativeEvent, 0.025))
          }
        >
          Regionsansicht
        </button>
        <button
          disabled={!state}
          aria-pressed={state?.scale === 0.000002}
          onClick={(e) =>
            action((editor) => editor.setViewScale(e.nativeEvent, 0.000002))
          }
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
      <span className="tool-hint">
        {mode === "pan"
          ? "Ziehen: Verschieben · Mausrad: Zoom"
          : mode === "house"
            ? "Klicken oder ziehen: Haus platzieren"
            : mode === "select"
              ? "Haus anklicken · Ziehen: Verschieben · Escape: Abbrechen"
              : landscape
                ? "Ziehen: Malen · Escape: Strich verwerfen"
                : mode === "land" || mode === "sea"
                  ? "Ziehen: Küste malen · [ / ]: Pinselgröße"
                  : "Ziehen oder halten: Höhen malen · [ / ]: Pinselgröße"}
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
