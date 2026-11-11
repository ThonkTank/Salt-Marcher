import { useState } from "react";
import type { EditorState } from "./EditorController";
import type { HouseHeader } from "./model";
import type { EditorAction } from "./EditorChrome";
import { landscapeNames } from "./EditorChrome";

function NumberField({
  label,
  value,
  unit,
  min,
  max,
  step = "any",
  onCommit,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number | "any";
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="field">
      <span>
        {label}
        <small>{unit}</small>
      </span>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft ?? value}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== null && draft.trim() !== "") onCommit(Number(draft));
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

export function ToolSettings({
  state,
  action,
}: {
  state: EditorState | null;
  action: EditorAction;
}) {
  const mode = state?.mode ?? "raise";
  const landscape = mode === "forest" || mode === "clearing";
  const houseMode = mode === "house" || mode === "select";
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
  return (
    <section className="atlas-settings" aria-label="Werkzeugeinstellungen">
      <p className="eyebrow">
        {mode === "select" ? "AUSWAHL" : "WERKZEUGEINSTELLUNGEN"}
      </p>
      <h1>
        {houseMode
          ? mode === "house"
            ? "Haus platzieren"
            : "Eigenschaften"
          : landscape
            ? "Landschaft"
            : mode === "pan"
              ? "Navigation"
              : "Höhen"}
      </h1>
      <fieldset
        className="tool-fields"
        disabled={!state || state.fileAction || state.recovering}
      >
        <legend className="visually-hidden">Aktuelles Werkzeug</legend>
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
              <NumberField
                key={`${selectedHouse?.id ?? "new"}:${field}`}
                label={label}
                unit={unit}
                min={min}
                max={max}
                value={+(houseSettings[field] * factor).toFixed(3)}
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
            <details className="future-options">
              <summary>Weitere Gebäudeeigenschaften</summary>
              <p className="hint">
                Diese Bedienelemente sind noch nicht angebunden.
              </p>
              <button disabled>Innen öffnen</button>
              <button disabled>Name ändern</button>
              <button disabled>Dachfarbe</button>
              <button disabled>Objekt löschen</button>
            </details>
          </>
        ) : (
          <>
            <NumberField
              label="Pinselgröße"
              unit="px"
              step={1}
              min={8}
              max={landscape ? 128 : 512}
              value={state?.diameter ?? 80}
              onCommit={(value) =>
                action((editor) => editor.setBrush(value, editor.amount))
              }
            />
            {landscape ? (
              <>
                <label className="field">
                  <span>Landschaft</span>
                  <select
                    aria-label="Landschaft"
                    value={state?.landscapeKind ?? 0}
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
                </label>
                {mode === "forest" ? (
                  <NumberField
                    label="Landschaftsdichte"
                    unit="%"
                    step={1}
                    min={0}
                    max={100}
                    value={state?.landscapeDensity ?? 100}
                    onCommit={(value) =>
                      action((editor) =>
                        editor.setLandscape(editor.state.landscapeKind, value),
                      )
                    }
                  />
                ) : (
                  <p className="hint">
                    Feine Lichtungen bleiben bei späteren groben Waldänderungen
                    frei.
                  </p>
                )}
              </>
            ) : (
              <>
                <NumberField
                  label="Pinselstärke"
                  unit="m/s"
                  min={0.03048}
                  max={3048}
                  step={1}
                  value={+((state?.amount ?? 20) * 0.3048).toFixed(3)}
                  onCommit={(value) =>
                    action((editor) =>
                      editor.setBrush(editor.diameter, value / 0.3048),
                    )
                  }
                />
                <details className="future-options">
                  <summary>Weitere Höhenwerkzeuge</summary>
                  <p className="hint">
                    Diese Werkzeuge sind noch nicht angebunden.
                  </p>
                  {[
                    "Land",
                    "Meer",
                    "Glätten",
                    "Einebnen",
                    "Bergkette",
                    "Hügel",
                    "Schlucht",
                  ].map((name) => (
                    <button key={name} disabled>
                      {name}
                    </button>
                  ))}
                </details>
              </>
            )}
          </>
        )}
      </fieldset>
    </section>
  );
}

export function SurfacePanel({
  state,
  action,
}: {
  state: EditorState | null;
  action: EditorAction;
}) {
  const selectedHouse = state?.mode === "select" ? state.selectedHouse : null;
  return (
    <section className="surface-panel" aria-label="Gewässer und Fundamente">
      <h2>Gewässer und Fundamente</h2>
      <button
        disabled={!state || state.fileAction || state.recovering}
        onClick={() => action((editor) => editor.openWaterScene())}
      >
        Gewässerszene öffnen
      </button>
      <p className="hint">Neue Karte mit See, Fluss und einem Haus am Ufer.</p>
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
              Das Gelände hat sich geändert. Bestätigte Maske und Pegel bleiben
              erhalten.
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
            Sichtbares Wasser wird bereits am aktuellen Gelände abgeschnitten.
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
  );
}
