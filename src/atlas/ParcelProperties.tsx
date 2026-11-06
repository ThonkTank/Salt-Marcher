import { NumberField } from "./Fields";
import type { BoundSource } from "./parcelPlanning";
export function ParcelProperties({
  source,
  excluded,
  onChange,
  onExcluded,
  onBack,
  disabled = false,
}: {
  source: Pick<BoundSource, "start" | "end" | "setback" | "depth">;
  excluded?: boolean;
  onChange: (
    patch: Partial<Pick<BoundSource, "start" | "end" | "setback" | "depth">>,
  ) => void;
  onExcluded?: (excluded: boolean) => void;
  onBack?: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="atlas-settings">
      {onBack && <button onClick={onBack}>← Zur Straßenplanung</button>}
      {onBack && <h2>Parzelle</h2>}
      <fieldset disabled={disabled} className="atlas-parcel-fields">
        <legend>Grenzen am Straßenabschnitt</legend>
        <NumberField
          label="Anfang (%)"
          value={source.start * 100}
          min={0}
          max={source.end * 100}
          step={0.1}
          onChange={(v) => onChange({ start: v / 100 })}
        />
        <NumberField
          label="Ende (%)"
          value={source.end * 100}
          min={source.start * 100}
          max={100}
          step={0.1}
          onChange={(v) => onChange({ end: v / 100 })}
        />
        <NumberField
          label="Straßenabstand (Fuß)"
          value={source.setback}
          min={0}
          max={1000}
          step={1}
          onChange={(v) => onChange({ setback: v })}
        />
        <NumberField
          label="Grundstückstiefe (Fuß)"
          value={source.depth}
          min={5}
          max={2000}
          step={1}
          onChange={(v) => onChange({ depth: v })}
        />
        {onExcluded && (
          <label className="atlas-checkbox">
            <input
              type="checkbox"
              checked={excluded ?? false}
              onChange={(e) => onExcluded(e.target.checked)}
            />
            Parzelle auslassen
          </label>
        )}
      </fieldset>
      {disabled && <small>Vorschau wird aktualisiert …</small>}
    </section>
  );
}
