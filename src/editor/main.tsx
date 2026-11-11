import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorController, type EditorState } from "./EditorController";
import { PreviewUpdates } from "./PreviewUpdates";
import type { HouseHeader, Point } from "./model";
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

function HouseField({
  label,
  value,
  unit,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="field">
      <label htmlFor={`house-${label}`}>
        {label}
        <span>{unit}</span>
      </label>
      <input
        id={`house-${label}`}
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step="any"
        value={draft ?? +value.toFixed(3)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== null && draft.trim() !== "") onCommit(Number(draft));
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </div>
  );
}

function Atlas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<EditorController | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [diameterDraft, setDiameterDraft] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [densityDraft, setDensityDraft] = useState<string | null>(null);
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const mode = state?.mode ?? "raise";
  const landscape = mode === "forest" || mode === "clearing";
  const houseMode = mode === "house" || mode === "select";
  const landscapeNames = ["Wald", "Buschland", "Wiese", "Felsgebiet"];
  const landscapeKind = state?.landscapeKind ?? 0;
  const landscapeDensity = state?.landscapeDensity ?? 100;
  const diameter = state?.diameter ?? 80;
  const amount = state?.amount ?? 20;
  const selectedHouse = mode === "select" ? state?.selectedHouse : null;
  const houseSettings = {
    width: selectedHouse?.width ?? state?.houseWidth ?? 40,
    depth: selectedHouse?.depth ?? state?.houseDepth ?? 30,
    rotation: selectedHouse?.rotation ?? state?.houseRotation ?? 0,
    foundationHeight:
      selectedHouse?.foundationHeight ?? state?.foundationHeight ?? 1,
    foundationTransition:
      selectedHouse?.foundationTransition ?? state?.foundationTransition ?? 10,
  };
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

  const action = (
    operation: (editor: EditorController) => void | Promise<void>,
  ) => {
    const editor = controller.current;
    if (!editor) return;
    editor.run(() => operation(editor));
  };
  const selectMode = (next: EditorState["mode"]) => {
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
        <PreviewUpdates />
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
            aria-pressed={mode === "forest"}
            onClick={() => selectMode("forest")}
          >
            <span>♧</span>
            {landscapeNames[landscapeKind]}
          </button>
          <button
            aria-pressed={mode === "clearing"}
            onClick={() => selectMode("clearing")}
          >
            <span>◯</span>Lichtung
          </button>
          <button
            aria-pressed={mode === "house"}
            onClick={() => selectMode("house")}
          >
            <span>⌂</span>Haus platzieren
          </button>
          <button
            aria-pressed={mode === "select"}
            onClick={() => selectMode("select")}
          >
            <span>↖</span>Haus auswählen
          </button>
          <button
            aria-pressed={mode === "pan"}
            onClick={() => selectMode("pan")}
          >
            <span>✥</span>Verschieben
          </button>
        </div>
        {houseMode ? (
          <>
            <p className="hint">
              {mode === "house"
                ? "Klicken oder ziehen, um ein Haus zu platzieren."
                : selectedHouse
                  ? "Haus ausgewählt. Zum Verschieben ziehen; Escape bricht die Bewegung ab."
                  : "Ein Haus anklicken und zum Verschieben ziehen."}
            </p>
            {(
              [
                ["width", "Hausbreite", "m", 0.3048, 3048, 0.3048],
                ["depth", "Haustiefe", "m", 0.3048, 3048, 0.3048],
                ["rotation", "Hausdrehung", "°", 0, 360, 1],
                ["foundationHeight", "Fundamenthöhe", "m", 0, 30.48, 0.3048],
                [
                  "foundationTransition",
                  "Fundamentübergang",
                  "m",
                  0,
                  152.4,
                  0.3048,
                ],
              ] as const
            ).map(([field, label, unit, min, max, factor]) => (
              <HouseField
                key={`${selectedHouse?.id ?? "new"}:${field}`}
                label={label}
                unit={unit}
                min={min}
                max={max}
                value={houseSettings[field] * factor}
                onCommit={(value) =>
                  action((editor) =>
                    editor.setHouseSettings({
                      [field]: value / factor,
                    } as Partial<HouseHeader>),
                  )
                }
              />
            ))}
            <p className="hint">
              Die Fundamentbasis folgt dem höchsten Gelände unter dem Haus. Die
              Fundamenthöhe bestimmt die Oberkante über dieser Basis.
            </p>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="diameter">
                Pinselgröße <span>px</span>
              </label>
              <input
                id="diameter"
                aria-label="Pinselgröße"
                type="number"
                min="8"
                max={landscape ? 128 : 512}
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
            {landscape ? (
              <>
                <div className="field">
                  <label htmlFor="landscape-kind">Landschaft</label>
                  <select
                    id="landscape-kind"
                    aria-label="Landschaft"
                    value={landscapeKind}
                    disabled={mode === "clearing"}
                    onChange={(event) =>
                      action((editor) =>
                        editor.setLandscape(
                          Number(event.target.value),
                          editor.state.landscapeDensity,
                        ),
                      )
                    }
                  >
                    {landscapeNames.map((name, index) => (
                      <option key={name} value={index}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                {mode === "forest" ? (
                  <div className="field">
                    <label htmlFor="landscape-density">
                      Dichte <span>%</span>
                    </label>
                    <input
                      id="landscape-density"
                      aria-label="Landschaftsdichte"
                      type="number"
                      min="0"
                      max="100"
                      value={densityDraft ?? landscapeDensity}
                      onChange={(event) => setDensityDraft(event.target.value)}
                      onBlur={() => {
                        if (densityDraft !== null && densityDraft.trim() !== "")
                          action((editor) =>
                            editor.setLandscape(
                              editor.state.landscapeKind,
                              Number(densityDraft),
                            ),
                          );
                        setDensityDraft(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                    />
                  </div>
                ) : (
                  <p className="hint">
                    Feine Lichtungen bleiben bei späteren groben Waldänderungen
                    frei.
                  </p>
                )}
              </>
            ) : (
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
            )}
          </>
        )}
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
        <section className="surface-panel" aria-label="Gewässer und Fundamente">
          <p className="eyebrow">GEWÄSSER UND FUNDAMENTE</p>
          <button
            disabled={state?.fileAction || state?.recovering}
            onClick={() => action((editor) => editor.openWaterScene())}
          >
            Gewässerszene öffnen
          </button>
          <p className="hint">
            Neue Karte mit See, Fluss und einem Haus am Ufer.
          </p>
          {state?.surfaces?.water.map((source) => (
            <div
              className="surface-item"
              key={source.id}
              role="group"
              aria-label={`Gewässer: ${source.name || source.id}`}
            >
              <strong>
                {source.name || (source.kind === "lake" ? "See" : "Fluss")}
              </strong>
              <span className={`surface-status ${source.status}`}>
                {source.status === "current"
                  ? "Aktuell"
                  : source.status === "stale"
                    ? "Veraltet"
                    : source.reason
                      ? "Nicht geprüft"
                      : "Wird geprüft"}
              </span>
              {source.status === "stale" && (
                <p>
                  Das Gelände hat sich geändert. Bestätigte Maske und Pegel
                  bleiben erhalten.
                </p>
              )}
              {source.reason && <p>{source.reason}</p>}
            </div>
          ))}
          {Boolean(state?.surfaces?.water.length) && (
            <>
              <button disabled aria-describedby="adapt-water-explanation">
                Gewässer an Gelände anpassen
              </button>
              <p className="hint" id="adapt-water-explanation">
                Die automatische Anpassung folgt in einer späteren Version.
                Sichtbares Wasser wird bereits am aktuellen Gelände
                abgeschnitten.
              </p>
            </>
          )}
          {state?.surfaces?.foundations
            .filter((foundation, i) =>
              selectedHouse ? foundation.id === selectedHouse.id : i < 4,
            )
            .map((foundation, i) => (
              <div className="surface-item" key={foundation.id}>
                <strong>
                  {selectedHouse ? "Ausgewähltes Haus" : `Haus ${i + 1}`}
                </strong>
                <span
                  className={`surface-status ${foundation.ready ? "current" : "unknown"}`}
                >
                  {foundation.ready
                    ? "Aktuell"
                    : foundation.reason
                      ? "Nicht berechnet"
                      : "Wird geprüft"}
                </span>
                <dl>
                  <dt>Fundamentbasis</dt>
                  <dd>
                    {foundation.base === null
                      ? "—"
                      : `${(foundation.base * 0.3048).toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m`}
                  </dd>
                  <dt>Fundamentoberkante</dt>
                  <dd>
                    {foundation.top === null
                      ? "—"
                      : `${(foundation.top * 0.3048).toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m`}
                  </dd>
                </dl>
                {foundation.reason && <p>{foundation.reason}</p>}
              </div>
            ))}
          {state?.surfaces?.message && (
            <p className="hint">{state.surfaces.message}</p>
          )}
          {(state?.surfaces?.water.some((source) => source.reason) ||
            state?.surfaces?.foundations.some(
              (foundation) => foundation.reason,
            )) && (
            <button onClick={() => action((editor) => editor.retrySurfaces())}>
              Erneut prüfen
            </button>
          )}
        </section>
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
              ? houseMode
                ? selectedHouse
                  ? "Haus ausgewählt"
                  : "Häuser"
                : `${((landscape ? 1 : 5) * 2 ** state.level * 0.3048).toLocaleString("de-DE", { maximumFractionDigits: 2 })} m · ${landscape ? "Landschaftsraster" : "Höhenraster"}`
              : ""}
          </span>
        </footer>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Atlas />);
