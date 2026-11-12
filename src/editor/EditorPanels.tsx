import { useRef, useState } from "react";
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
  unit?: string;
  min: number;
  max: number;
  step?: number | "any";
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  return (
    <label className="field">
      <span>
        {label}
        {unit && <small>{unit}</small>}
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
          if (!cancelled.current && draft !== null && draft.trim() !== "")
            onCommit(Number(draft));
          cancelled.current = false;
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          cancelled.current = event.key === "Escape";
          event.currentTarget.blur();
        }}
      />
    </label>
  );
}

const heightModes = [
  ["land", "Land"],
  ["sea", "Meer"],
  ["mountains", "Bergkette"],
  ["hills", "Hügel"],
  ["canyon", "Schlucht"],
  ["raise", "Anheben"],
  ["lower", "Absenken"],
  ["smooth", "Glätten"],
  ["flatten", "Einebnen"],
] as const;
const distanceFormat = new Intl.NumberFormat("de-DE", {
  maximumSignificantDigits: 3,
});
function brushDistance(feet: number) {
  const metres = feet * 0.3048;
  return metres >= 1000
    ? `${distanceFormat.format(metres / 1000)} km`
    : `${distanceFormat.format(metres)} m`;
}

function HeightSettings({
  state,
  action,
}: {
  state: EditorState | null;
  action: EditorAction;
}) {
  const diameter = state ? state.diameter / state.scale : null;
  const spacing = state ? 5 * 2 ** state.level : null;
  const coast = state?.heightMode === "land" || state?.heightMode === "sea";
  const roughness = state?.coastRoughness ?? 0;
  return (
    <>
      <label className="field">
        <span>Pinselmodus</span>
        <select
          aria-label="Pinselmodus"
          value={state?.heightMode ?? "raise"}
          onChange={(event) => {
            const mode = event.target.value;
            if (
              mode === "land" ||
              mode === "sea" ||
              mode === "raise" ||
              mode === "lower"
            )
              action((editor) => editor.setMode(mode));
          }}
        >
          {heightModes.map(([mode, label]) => (
            <option
              key={mode}
              value={mode}
              disabled={
                mode !== "land" &&
                mode !== "sea" &&
                mode !== "raise" &&
                mode !== "lower"
              }
            >
              {label}
            </option>
          ))}
        </select>
      </label>
      {coast && (
        <>
          <label className="field">
            <span>Küstenform</span>
            <select
              aria-label="Küstenform"
              value={roughness > 0 ? "crinkled" : "round"}
              onChange={(event) =>
                action((editor) =>
                  editor.setCoastRoughness(
                    event.target.value === "crinkled" ? 0.65 : 0,
                  ),
                )
              }
            >
              <option value="round">Rund</option>
              <option value="crinkled">Kräuselig</option>
            </select>
          </label>
          {roughness > 0 && (
            <>
              <label className="field">
                <span>Küstenrauheit: {Math.round(roughness * 100)} %</span>
                <input
                  aria-label="Küstenrauheit (%)"
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={Math.round(roughness * 100)}
                  onChange={(event) =>
                    action((editor) =>
                      editor.setCoastRoughness(
                        Number(event.target.value) / 100,
                      ),
                    )
                  }
                />
              </label>
              <small>
                Unregelmäßige Buchten und Landzungen innerhalb des
                Pinselkreises.
              </small>
            </>
          )}
        </>
      )}
      <NumberField
        label="Pinselgröße (Pixel)"
        step={1}
        min={8}
        max={512}
        value={state?.diameter ?? 80}
        onCommit={(value) =>
          action((editor) => editor.setBrush(value, editor.amount))
        }
      />
      {diameter !== null && spacing !== null && (
        <>
          <small>
            Durchmesser: {brushDistance(diameter)} · Höhenraster:{" "}
            {brushDistance(spacing)}
          </small>
          {diameter < spacing && (
            <small>
              Kleine Pinsel können zwischen den Rasterpunkten ohne Höhenänderung
              bleiben. Pinsel vergrößern oder den Strich versetzen.
            </small>
          )}
        </>
      )}
      {!coast && (
        <NumberField
          label="Höhenänderung (m/s)"
          min={0.03048}
          max={3048}
          step="any"
          value={Number(((state?.amount ?? 20) * 0.3048).toPrecision(15))}
          onCommit={(value) =>
            action((editor) => editor.setBrush(editor.diameter, value / 0.3048))
          }
        />
      )}
      <label className="check height-contours">
        <input type="checkbox" disabled aria-describedby="height-unavailable" />
        Höhenlinien
      </label>
      <small id="height-unavailable">
        Ausgegraute Pinselmodi und Höhenlinien sind noch nicht verfügbar.
      </small>
      <small>
        Ziehen: Direkt malen · Loslassen / Escape: Strich beenden · Rückgängig:
        Strich entfernen
      </small>
      <small>
        {coast
          ? "Halten verändert die Küste nicht weiter."
          : "Halten vertieft weiter."}{" "}
        [ / ] oder Alt+Mausrad: Pinselgröße
      </small>
    </>
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
  const height =
    mode === "land" || mode === "sea" || mode === "raise" || mode === "lower";
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
    <section
      className={`atlas-settings${height ? " height-settings" : ""}`}
      aria-label="Werkzeugeinstellungen"
    >
      {height ? (
        <h2>Höhen</h2>
      ) : (
        <>
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
                : "Navigation"}
          </h1>
        </>
      )}
      <fieldset
        className="tool-fields"
        disabled={!state || state.fileAction || state.recovering}
      >
        <legend className="visually-hidden">Aktuelles Werkzeug</legend>
        {height ? (
          <HeightSettings state={state} action={action} />
        ) : houseMode ? (
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
        ) : landscape ? (
          <>
            <NumberField
              label="Pinselgröße"
              unit="px"
              step={1}
              min={8}
              max={128}
              value={state?.diameter ?? 80}
              onCommit={(value) =>
                action((editor) => editor.setBrush(value, editor.amount))
              }
            />
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
          <p className="hint">Ziehen: Ansicht verschieben · Mausrad: Zoomen</p>
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
