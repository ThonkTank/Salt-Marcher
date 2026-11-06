import type { RoadRoughness } from "./generated/RoadRoughness";
import { NumberField } from "./Fields";
export function RoughnessControls({
  value,
  onChange,
  onVariation,
}: {
  value: RoadRoughness;
  onChange: (amount: number) => void;
  onVariation: () => void;
}) {
  return (
    <div className="atlas-settings">
      <NumberField
        label="Rauheit"
        value={value.amount}
        min={0}
        max={1}
        step={0.01}
        onChange={onChange}
      />
      <input
        aria-label="Rauheit einstellen"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value.amount}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <button onClick={onVariation}>Neue Variation</button>
      <small>
        Bleibt im Entwurf beim Zoomen gleich groß sichtbar. Übernehmen fixiert
        den Verlauf.
      </small>
    </div>
  );
}
