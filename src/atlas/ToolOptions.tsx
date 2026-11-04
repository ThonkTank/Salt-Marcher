import type { Tool } from "./editorSelection";
import { NumberField } from "./Fields";
import type { PopulationSettings } from "./model";
import { PopulationSettingsFields } from "./PopulationPanel";

export const labels: Record<Tool, string> = {
  select: "Auswahl",
  road: "Straße",
  area: "Gelände",
  house: "Haus",
  draw: "Raum",
  erase: "Radieren",
  assign: "Zuweisen",
  opening: "Tür",
  stairs: "Treppe",
};
export function ToolOptions({
  tool,
  roadWidth,
  material,
  opening,
  travel,
  onRoadWidth,
  onMaterial,
  onOpening,
  onTravel,
  populateRoad,
  onPopulateRoad,
  settings,
  updateSettings,
  extending,
}: {
  tool: Tool;
  roadWidth: number;
  material: string;
  opening: "door" | "passage";
  travel: "up" | "down";
  onRoadWidth: (value: number) => void;
  onMaterial: (value: string) => void;
  onOpening: (value: "door" | "passage") => void;
  onTravel: (value: "up" | "down") => void;
  populateRoad: boolean;
  onPopulateRoad: (value: boolean) => void;
  settings: PopulationSettings;
  updateSettings: (value: PopulationSettings) => void;
  extending: boolean;
}) {
  return (
    <div className="atlas-settings">
      <h2>{labels[tool]}</h2>
      {tool === "road" && (
        <>
          {!extending && (
            <NumberField
              label="Straßenbreite (Fuß)"
              value={roadWidth}
              min={2}
              max={100}
              onChange={(v) => {
                onRoadWidth(v);
              }}
            />
          )}
          <label>
            Material
            <select
              aria-label="Material"
              value={material}
              disabled={extending}
              onChange={(e) => onMaterial(e.target.value)}
            >
              <option value="earth">Erde</option>
              <option value="stone">Stein</option>
            </select>
          </label>
          <label>
            Bebauung
            <select
              aria-label="Bebauung"
              value={
                !populateRoad
                  ? "none"
                  : settings.houses === false
                    ? "parcels"
                    : "houses"
              }
              onChange={(e) => {
                const enabled = e.target.value !== "none";
                onPopulateRoad(enabled);
                if (enabled)
                  updateSettings({
                    ...settings,
                    houses: e.target.value === "houses",
                  });
              }}
            >
              <option value="houses">Parzellen und Häuser</option>
              <option value="parcels">Nur Parzellen</option>
              <option value="none">Keine</option>
            </select>
          </label>
          {populateRoad && (
            <PopulationSettingsFields
              settings={settings}
              updateSettings={updateSettings}
            />
          )}
          {extending && <small>Verlängerung · nur neue Abschnitte</small>}
        </>
      )}
      {tool === "area" && (
        <label>
          Material
          <select
            aria-label="Material"
            value={material}
            onChange={(e) => {
              onMaterial(e.target.value);
            }}
          >
            {["grass", "earth", "stone", "water"].map((m) => (
              <option key={m} value={m}>
                {
                  {
                    grass: "Gras",
                    earth: "Erde",
                    stone: "Stein",
                    water: "Wasser",
                  }[m]
                }
              </option>
            ))}
          </select>
        </label>
      )}
      {tool === "opening" && (
        <label>
          Art
          <select
            value={opening}
            onChange={(e) => onOpening(e.target.value as typeof opening)}
          >
            <option value="door">Tür</option>
            <option value="passage">Durchgang</option>
          </select>
        </label>
      )}
      {tool === "stairs" && (
        <>
          <label>
            Richtung
            <select
              value={travel}
              onChange={(e) => onTravel(e.target.value as typeof travel)}
            >
              <option value="up">Hoch</option>
              <option value="down">Runter</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}
