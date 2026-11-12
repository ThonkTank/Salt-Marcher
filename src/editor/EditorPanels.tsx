import { useEffect, useState } from "react";
import type { EditorState } from "./EditorController";
import type { HouseHeader } from "./model";
import type { EditorAction } from "./EditorChrome";
import { landscapeNames } from "./EditorChrome";
import { EditorIcon } from "./EditorIcon";
import { RangeField } from "./RangeField";

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

function BrushMetrics({
  state,
  landscape = false,
}: {
  state: EditorState | null;
  landscape?: boolean;
}) {
  if (!state) return null;
  const diameter = state.diameter / state.scale;
  const spacing = (landscape ? 1 : 5) * 2 ** state.level;
  return (
    <>
      <dl className="brush-metrics" role="group" aria-label="Pinselmaße">
        <div>
          <dt>Weltdurchmesser</dt>
          <dd>{brushDistance(diameter)}</dd>
        </div>
        <div>
          <dt>{landscape ? "Landschaftsraster" : "Höhenraster"}</dt>
          <dd>{brushDistance(spacing)}</dd>
        </div>
      </dl>
      {!landscape && diameter < spacing && (
        <p className="field-note warning-note">
          Der Pinsel ist kleiner als das Höhenraster. Vergrößere ihn oder
          versetze den Strich, damit er Rasterpunkte erreicht.
        </p>
      )}
    </>
  );
}

function HeightSettings({
  state,
  action,
}: {
  state: EditorState | null;
  action: EditorAction;
}) {
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
            <RangeField
              label="Küstenrauheit (%)"
              unit="%"
              min={5}
              max={100}
              step={5}
              value={Math.round(roughness * 100)}
              onCommit={(value) =>
                action((editor) => editor.setCoastRoughness(value / 100))
              }
            />
          )}
        </>
      )}
      <RangeField
        label="Pinselgröße (Pixel)"
        unit="px"
        min={8}
        max={512}
        value={state?.diameter ?? 80}
        onCommit={(value) =>
          action((editor) => editor.setBrush(value, editor.amount))
        }
      />
      <BrushMetrics state={state} />
      {!coast && (
        <RangeField
          label="Höhenänderung (m/s)"
          unit="m/s"
          min={0.03048}
          max={3048}
          scale="log"
          value={(state?.amount ?? 20) * 0.3048}
          onCommit={(value) =>
            action((editor) => editor.setBrush(editor.diameter, value / 0.3048))
          }
        />
      )}
      <p className="field-note">
        {coast
          ? roughness > 0
            ? "Buchten und Landzungen entstehen innerhalb des Pinselkreises. Halten verändert die Küste nicht weiter."
            : "Land oder Meer mit einer runden Küste malen. Halten verändert die Küste nicht weiter."
          : "Langsames Ziehen und Halten verstärken die Wirkung."}
      </p>
      <label className="check height-contours">
        <input
          type="checkbox"
          aria-label="Höhenlinien"
          disabled
          aria-describedby="height-unavailable"
        />
        Höhenlinien{" "}
        <span className="soon-label" aria-hidden="true">
          Folgt
        </span>
      </label>
      <p className="field-note" id="height-unavailable">
        Ausgegraute Pinselmodi und Höhenlinien sind noch nicht verfügbar.
      </p>
      <details className="tool-help">
        <summary>Bedienung</summary>
        <p>
          {coast ? "Ziehen: Küste malen." : "Ziehen oder halten: direkt malen."}{" "}
          Loslassen oder <kbd>Esc</kbd> beendet den Strich; Rückgängig entfernt
          ihn.
        </p>
        <p>
          <kbd>[</kbd> / <kbd>]</kbd> oder <kbd>Alt</kbd> + Mausrad ändert die
          Pinselgröße.
        </p>
        <p>Für genaue Werte auf die Zahl neben einem Regler klicken.</p>
      </details>
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
  const houseField = (
    field: keyof typeof houseSettings,
    label: string,
    unit: string,
    min: number,
    max: number,
    factor: number,
    scale: "linear" | "log" = "linear",
  ) => (
    <RangeField
      key={field}
      label={label}
      unit={unit}
      min={min}
      max={max}
      scale={scale}
      step={field === "rotation" ? 1 : 0.01}
      value={houseSettings[field] * factor}
      live={false}
      onCommit={(value) =>
        action((editor) =>
          editor.setHouseSettings({
            [field]: value / factor,
          } as Partial<HouseHeader>),
        )
      }
    />
  );
  return (
    <section className="atlas-settings" aria-label="Werkzeugeinstellungen">
      <div className="settings-heading">
        <p className="eyebrow">{mode === "select" ? "AUSWAHL" : "WERKZEUG"}</p>
        <h2>
          {height
            ? "Höhen"
            : houseMode
              ? mode === "house"
                ? "Haus platzieren"
                : "Eigenschaften"
              : landscape
                ? "Landschaft"
                : "Navigation"}
        </h2>
      </div>
      <fieldset
        key={`${mode}:${selectedHouse?.id ?? "new"}`}
        className="tool-fields"
        disabled={!state || state.fileAction || state.recovering}
      >
        <legend className="visually-hidden">Aktuelles Werkzeug</legend>
        {height ? (
          <HeightSettings state={state} action={action} />
        ) : mode === "select" && !selectedHouse ? (
          <div className="selection-empty">
            <EditorIcon name="select" />
            <h3>Kein Haus ausgewählt</h3>
            <p>
              Klicke auf ein Haus in der Karte, um seine Maße und sein Fundament
              zu bearbeiten.
            </p>
            <button onClick={() => action((editor) => editor.setMode("house"))}>
              Neues Haus platzieren
            </button>
          </div>
        ) : houseMode ? (
          <>
            <p className="field-note">
              {selectedHouse
                ? "Zum Verschieben am Haus ziehen. Escape bricht die Bewegung ab."
                : "Klicken oder ziehen, um ein Haus zu platzieren."}
            </p>
            <fieldset className="settings-group">
              <legend>Abmessungen</legend>
              {houseField(
                "width",
                "Hausbreite",
                "m",
                0.3048,
                3048,
                0.3048,
                "log",
              )}
              {houseField(
                "depth",
                "Haustiefe",
                "m",
                0.3048,
                3048,
                0.3048,
                "log",
              )}
              {houseField("rotation", "Hausdrehung", "°", 0, 360, 1)}
            </fieldset>
            <fieldset className="settings-group">
              <legend>Fundament</legend>
              {houseField(
                "foundationHeight",
                "Fundamenthöhe",
                "m",
                0,
                30.48,
                0.3048,
              )}
              {houseField(
                "foundationTransition",
                "Fundamentübergang",
                "m",
                0,
                152.4,
                0.3048,
              )}
              <p className="field-note">
                Die Basis folgt dem höchsten Gelände unter dem Haus. Die Höhe
                bestimmt die Oberkante darüber.
              </p>
            </fieldset>
            <p className="field-note">
              Regler loslassen, um den Wert zu übernehmen. Für genaue Maße auf
              den Wert klicken.
            </p>
            <details className="future-options">
              <summary>Weitere Gebäudeeigenschaften</summary>
              <p className="hint">
                Diese Funktionen sind noch nicht verfügbar.
              </p>
              <button disabled>Innen öffnen</button>
              <button disabled>Name ändern</button>
              <button disabled>Dachfarbe</button>
              <button disabled>Objekt löschen</button>
            </details>
          </>
        ) : landscape ? (
          <>
            <div
              className="segmented-control"
              role="group"
              aria-label="Landschaftsmodus"
            >
              <button
                aria-pressed={mode === "forest"}
                onClick={() => action((editor) => editor.setMode("forest"))}
              >
                Malen
              </button>
              <button
                aria-label="Lichtung malen"
                aria-pressed={mode === "clearing"}
                onClick={() => action((editor) => editor.setMode("clearing"))}
              >
                Lichtung
              </button>
            </div>
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
            <RangeField
              label="Pinselgröße"
              unit="px"
              min={8}
              max={128}
              value={state?.diameter ?? 80}
              onCommit={(value) =>
                action((editor) => editor.setBrush(value, editor.amount))
              }
            />
            <BrushMetrics state={state} landscape />
            {mode === "forest" ? (
              <RangeField
                label="Landschaftsdichte"
                unit="%"
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
              <p className="field-note">
                Feine Lichtungen bleiben bei späteren groben Waldänderungen
                frei.
              </p>
            )}
            <details className="tool-help">
              <summary>Bedienung</summary>
              <p>
                Ziehen: Landschaft malen. Loslassen schließt den Strich ab;{" "}
                <kbd>Esc</kbd> verwirft den laufenden Strich.
              </p>
              <p>Für genaue Werte auf die Zahl neben einem Regler klicken.</p>
            </details>
          </>
        ) : (
          <div className="navigation-guide">
            <EditorIcon name="pan" />
            <p>Ziehe auf der Karte, um den Ausschnitt zu verschieben.</p>
            <dl>
              <dt>Zoomen</dt>
              <dd>Mausrad</dd>
              <dt>Ansicht wählen</dt>
              <dd>Schaltflächen unten in der Karte</dd>
              <dt>Bestimmten Ort öffnen</dt>
              <dd>Zu Koordinaten</dd>
            </dl>
          </div>
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
  const hasDetails = Boolean(
    state?.surfaces?.water.length || state?.surfaces?.foundations.length,
  );
  const attention = [
    state?.surfaces?.message,
    ...(state?.surfaces?.water ?? []).map((source) =>
      source.status === "stale" || source.reason
        ? `${source.id}:${source.status}:${source.reason ?? ""}`
        : "",
    ),
    ...(state?.surfaces?.foundations ?? []).map((foundation) =>
      foundation.reason ? `${foundation.id}:${foundation.reason}` : "",
    ),
  ]
    .filter(Boolean)
    .join("\n");
  const [open, setOpen] = useState(hasDetails);
  useEffect(() => setOpen(hasDetails), [hasDetails]);
  useEffect(() => {
    if (attention || selectedHouse) setOpen(true);
  }, [attention, selectedHouse?.id]);
  return (
    <section className="surface-panel" aria-label="Gewässer und Fundamente">
      <details
        className="surface-details"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>Gewässer und Fundamente</summary>
        <div className="surface-content">
          <button
            disabled={!state || state.fileAction || state.recovering}
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
        </div>
      </details>
    </section>
  );
}
