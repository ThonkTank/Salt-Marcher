import { RoughnessControls } from "./RoughnessControls";
import type { EditorTools } from "./useEditorTools";
import type { Tool } from "./editorSelection";
import { NumberField, SelectField } from "./Fields";
import { PopulationSettingsFields } from "./PopulationPanel";

export const toolLabels: Record<Tool, { label: string; icon: string }> = {
  select: { label: "Auswahl", icon: "↖" },
  road: { label: "Straße", icon: "↝" },
  area: { label: "Flächen", icon: "▧" },
  terrain: { label: "Höhen", icon: "▵" },
  scenery: { label: "Landschaft", icon: "♣" },
  house: { label: "Haus", icon: "⌂" },
  draw: { label: "Raum", icon: "▱" },
  erase: { label: "Radieren", icon: "⌫" },
  assign: { label: "Zuweisen", icon: "⇥" },
  opening: { label: "Tür", icon: "⊓" },
  stairs: { label: "Treppe", icon: "▥" },
};
export function toolbarTools(interior: boolean): Tool[] {
  return interior
    ? ["select", "draw", "erase", "assign", "opening", "stairs"]
    : ["select", "road", "area", "terrain", "scenery", "house"];
}
export function ToolOptions({
  tools,
  waterLevel,
  onWaterLevel,
  tool,
  extending,
}: {
  tools: EditorTools;
  waterLevel: number;
  onWaterLevel: (value: number) => void;
  tool: Tool;
  extending: boolean;
}) {
  const {
    scenery,
    changeScenery,
    brush,
    changeBrush,
    contours,
    changeContours,
    roadWidth,
    changeRoadWidth,
    material,
    changeMaterial,
    opening,
    changeOpening,
    travel,
    changeTravel,
    populateRoad,
    changePopulationEnabled,
    settings,
    changePopulationSettings,
    roughness,
    changeRoughness,
    newVariation,
  } = tools;
  return (
    <div className="atlas-settings">
      <h2>{toolLabels[tool].label}</h2>
      {tool === "scenery" && (
        <>
          <SelectField
            label="Landschaftsart"
            value={scenery.biome}
            options={{
              forest: "Wald",
              meadow: "Wiese",
              scrub: "Buschland",
              rocks: "Felsen",
            }}
            onChange={(biome) => changeScenery({ ...scenery, biome })}
          />
          <NumberField
            label="Pinselradius (Fuß)"
            value={scenery.radius}
            min={5}
            max={500}
            onChange={(radius) => changeScenery({ ...scenery, radius })}
          />
          <NumberField
            label="Dichte (%)"
            value={scenery.density * 100}
            min={5}
            max={100}
            onChange={(density) =>
              changeScenery({ ...scenery, density: density / 100 })
            }
          />
          <NumberField
            label="Assetgröße (Fuß)"
            value={scenery.size}
            min={1}
            max={80}
            onChange={(size) => changeScenery({ ...scenery, size })}
          />
          <small>
            Ziehen: Assets streuen · Loslassen: Übernehmen · Escape: Abbrechen.
            Größe bezeichnet den ungefähren Radius. Auswahl und Entf löschen
            einen ganzen Strich.
          </small>
        </>
      )}
      {tool === "terrain" && (
        <>
          <SelectField
            label="Pinselmodus"
            value={brush.mode}
            options={{
              raise: "Anheben",
              lower: "Absenken",
              smooth: "Glätten",
              flatten: "Einebnen",
            }}
            onChange={(mode) => changeBrush({ ...brush, mode })}
          />
          <NumberField
            label="Pinselradius (Fuß)"
            value={brush.radius}
            min={5}
            max={500}
            onChange={(radius) => changeBrush({ ...brush, radius })}
          />
          {(brush.mode === "raise" || brush.mode === "lower") && (
            <NumberField
              label="Höhenänderung (Fuß)"
              step={0.1}
              value={brush.amount}
              min={0.1}
              max={100}
              onChange={(amount) => changeBrush({ ...brush, amount })}
            />
          )}
          {(brush.mode === "smooth" || brush.mode === "flatten") && (
            <NumberField
              label="Stärke"
              step={0.05}
              value={brush.strength}
              min={0.01}
              max={1}
              onChange={(strength) => changeBrush({ ...brush, strength })}
            />
          )}
          {brush.mode === "flatten" && (
            <NumberField
              label="Zielhöhe (Fuß)"
              value={brush.target}
              min={-100000}
              max={100000}
              onChange={(target) => changeBrush({ ...brush, target })}
            />
          )}
          <NumberField
            label="Wasserstand (Fuß)"
            value={waterLevel}
            min={-100000}
            max={100000}
            onChange={onWaterLevel}
          />
          <label className="atlas-checkbox">
            <input
              type="checkbox"
              checked={contours}
              onChange={(e) => changeContours(e.target.checked)}
            />
            Höhenlinien
          </label>
          <small>
            Ziehen: Gelände formen · Loslassen: Übernehmen · Escape: Abbrechen
          </small>
        </>
      )}
      {tool === "road" && (
        <>
          {!extending && (
            <NumberField
              label="Straßenbreite (Fuß)"
              value={roadWidth}
              min={2}
              max={100}
              onChange={changeRoadWidth}
            />
          )}
          <RoughnessControls
            value={roughness}
            onChange={changeRoughness}
            onVariation={newVariation}
          />
          <SelectField
            label="Material"
            value={material}
            disabled={extending}
            options={{ earth: "Erde", stone: "Stein" }}
            onChange={changeMaterial}
          />
          <SelectField
            label="Bebauung"
            value={
              !populateRoad
                ? "none"
                : settings.houses === false
                  ? "parcels"
                  : "houses"
            }
            options={{
              houses: "Parzellen und Häuser",
              parcels: "Nur Parzellen",
              none: "Keine",
            }}
            onChange={(value) => {
              const enabled = value !== "none";
              changePopulationEnabled(enabled);
              if (enabled)
                changePopulationSettings({
                  ...settings,
                  houses: value === "houses",
                });
            }}
          />
          {populateRoad && (
            <PopulationSettingsFields
              settings={settings}
              updateSettings={changePopulationSettings}
            />
          )}
          {extending && <small>Verlängerung · nur neue Abschnitte</small>}
        </>
      )}
      {tool === "area" && (
        <SelectField
          label="Material"
          value={material}
          options={{
            grass: "Gras",
            earth: "Erde",
            stone: "Stein",
            water: "Wasser",
          }}
          onChange={changeMaterial}
        />
      )}
      {tool === "opening" && (
        <SelectField
          label="Art"
          value={opening}
          options={{ door: "Tür", passage: "Durchgang" }}
          onChange={changeOpening}
        />
      )}
      {tool === "stairs" && (
        <SelectField
          label="Richtung"
          value={travel}
          options={{ up: "Hoch", down: "Runter" }}
          onChange={changeTravel}
        />
      )}
    </div>
  );
}
