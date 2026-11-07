import { NumberField, SelectField } from "./Fields";
import type { PopulationSettings, Preview } from "./model";
import { previewCounts } from "./editorWorkflow";

export function PopulationSettingsFields({
  settings,
  updateSettings,
}: {
  settings: PopulationSettings;
  updateSettings: (settings: PopulationSettings) => void;
}) {
  const field = (
    key: "setback" | "gap" | "minWidth" | "maxWidth" | "minDepth" | "maxDepth",
    label: string,
    mult = 1,
  ) => (
    <NumberField
      label={label}
      value={settings[key] * mult}
      min={key === "setback" || key === "gap" ? 0 : 5}
      max={mult === 5 ? 320 : 1000}
      step={mult}
      onChange={(v) => updateSettings({ ...settings, [key]: v / mult })}
    />
  );
  return (
    <details className="atlas-population-details">
      <summary>Bebauungsdetails</summary>
      {settings.layout && (
        <p>
          Individuelle Aufteilung. Gemeinsame Maße werden mit „Aufteilung neu
          erzeugen“ wieder freigegeben.
        </p>
      )}
      <fieldset
        disabled={!!settings.layout}
        className="atlas-population-fields"
      >
        <legend>Maße und Abstände</legend>
        <SelectField
          label="Straßenseite"
          value={settings.side}
          options={{ both: "Beide Seiten", left: "Links", right: "Rechts" }}
          onChange={(side) => updateSettings({ ...settings, side })}
        />
        {field("setback", "Abstand zur Straße (Fuß)")}
        {settings.houses !== false && field("gap", "Hausabstand (Fuß)")}
        <fieldset>
          <legend>
            {settings.houses === false ? "Grundstücksbreite" : "Hausbreite"}{" "}
            (Fuß)
          </legend>
          <div className="atlas-field-pair">
            {field("minWidth", "Min. Breite (Fuß)", 5)}
            {field("maxWidth", "Max. Breite (Fuß)", 5)}
          </div>
        </fieldset>
        {settings.houses !== false && (
          <fieldset>
            <legend>Haustiefe (Fuß)</legend>
            <div className="atlas-field-pair">
              {field("minDepth", "Min. Tiefe (Fuß)", 5)}
              {field("maxDepth", "Max. Tiefe (Fuß)", 5)}
            </div>
          </fieldset>
        )}
        <details>
          <summary>Erweitert</summary>
          <SelectField
            label="Parzellentiefe"
            value={settings.parcelDepth === null ? "auto" : "manual"}
            options={{ auto: "Auto", manual: "Manuell" }}
            onChange={(value) =>
              updateSettings({
                ...settings,
                parcelDepth:
                  value === "auto"
                    ? null
                    : 5 * settings.maxDepth + settings.gap,
              })
            }
          />
          {settings.parcelDepth !== null && (
            <NumberField
              label="Parzellentiefe (Fuß)"
              value={settings.parcelDepth}
              min={5}
              max={2000}
              onChange={(v) => updateSettings({ ...settings, parcelDepth: v })}
            />
          )}
          <p>Auto: {5 * settings.maxDepth + settings.gap} Fuß</p>
        </details>
      </fieldset>
      <button
        onClick={() =>
          updateSettings({
            ...settings,
            seed: (settings.seed + 1) >>> 0,
            layout: undefined,
          })
        }
      >
        {settings.layout ? "Aufteilung neu erzeugen" : "Neue Variante"}
      </button>
    </details>
  );
}
export function PreviewSummary({ preview }: { preview: Preview | null }) {
  const counts = preview?.generationSummary;
  const limit = preview?.generationLimit;
  const limitText = limit
    ? {
        boundParcels: "200 gebundene Parzellen je Straße",
        newHouses: "200 neue Häuser pro Aktion",
        newCells: "100.000 neue Zellen pro Aktion",
        attempts: "10.000 Platzierungsversuche pro Aktion",
      }[limit]
    : null;
  return (
    <div className="atlas-preview-summary" aria-live="polite">
      <p>
        {counts
          ? `${previewCounts(preview!).roads} Straßen · ${counts.createdParcels} neue Parzellen · ${counts.createdHouses} Häuser · ${counts.emptyParcels} leer · ${counts.skippedParcels} Grundstücke ausgelassen`
          : "Vorschau wird geprüft …"}
      </p>
      {limitText && <p>Limit erreicht: {limitText}.</p>}
      {!!preview?.generationDiagnostics.length && (
        <details>
          <summary>Hinweise ({preview.generationDiagnostics.length})</summary>
          {preview.generationDiagnostics.map((s, i) => (
            <p key={i}>{s.message}</p>
          ))}
        </details>
      )}
    </div>
  );
}
export function PopulationPanel({
  settings,
  updateSettings,
}: {
  settings: PopulationSettings;
  updateSettings: (settings: PopulationSettings) => void;
}) {
  return (
    <section className="atlas-population">
      <h2>Bebauung</h2>
      <SelectField
        label="Bebauung"
        value={settings.houses === false ? "parcels" : "houses"}
        options={{ houses: "Parzellen und Häuser", parcels: "Nur Parzellen" }}
        onChange={(value) =>
          updateSettings({ ...settings, houses: value === "houses" })
        }
      />
      <PopulationSettingsFields
        settings={settings}
        updateSettings={updateSettings}
      />
    </section>
  );
}
