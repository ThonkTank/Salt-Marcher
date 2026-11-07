import {
  featurePreset,
  featurePresets,
  isFeatureBrush,
  metres,
  terrainScreenRadius,
} from "./featureBrush";
import type { terrainBrushInfo as projectTerrainBrushInfo } from "./editorView";
import { GroundControls } from "./GroundControls";
import { RoughnessControls } from "./RoughnessControls";
import type { EditorTools } from "./useEditorTools";
import type { Tool } from "./editorSelection";
import { NumberField, SelectField } from "./Fields";
import { PopulationSettingsFields } from "./PopulationPanel";

export const toolLabels: Record<Tool, { label: string; icon: string }> = {
  water: { label: "Gewässer", icon: "≈" },
  river: { label: "Fluss", icon: "≋" },
  regions: { label: "Regionen", icon: "⚑" },
  select: { label: "Auswahl", icon: "↖" },
  road: { label: "Straße", icon: "↝" },
  area: { label: "Boden", icon: "▧" },
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
    : [
        "select",
        "road",
        "river",
        "water",
        "area",
        "terrain",
        "scenery",
        "regions",
        "house",
      ];
}
export function ToolOptions({
  tools,
  tool,
  extending,
  terrainBrushInfo,
  focusTerrainBrush,
}: {
  tools: EditorTools;
  tool: Tool;
  extending: boolean;
  focusTerrainBrush: (radius: number) => void;
  terrainBrushInfo: ReturnType<typeof projectTerrainBrushInfo>;
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
  const featureIndex = isFeatureBrush(brush.mode)
    ? featurePresets[brush.mode].findIndex(
        (p) =>
          Math.abs(p.width - brush.radius * 2 * metres) < 0.01 &&
          Math.abs(p.height - (brush.featureHeight ?? 100) * metres) < 0.01,
      )
    : -1;
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
              rocks: "Felsgebiet",
            }}
            onChange={(biome) => changeScenery({ ...scenery, biome })}
          />
          <NumberField
            label="Pinselgröße (Pixel)"
            value={scenery.radius * 2}
            min={8}
            max={512}
            onChange={(radius) =>
              changeScenery({ ...scenery, radius: radius / 2 })
            }
          />
          <NumberField
            label="Ziel-Dichte (%)"
            value={Number((scenery.density * 100).toPrecision(15))}
            min={5}
            max={100}
            onChange={(density) =>
              changeScenery({ ...scenery, density: density / 100 })
            }
          />
          <SelectField
            label="Auftrag"
            value={scenery.mode ?? "paint"}
            options={{ paint: "Malen", erase: "Entfernen" }}
            onChange={(mode) => changeScenery({ ...scenery, mode })}
          />
          <small>
            Flächen malen · Dichte bestimmt den Zielbestand. Entfernen schafft
            Lichtungen. Darstellung folgt dem Maßstab.
          </small>
        </>
      )}
      {tool === "water" && (
        <>
          <NumberField
            label="Pinselgröße (Pixel)"
            value={terrainScreenRadius(brush, 1, true) * 2}
            min={8}
            max={512}
            onChange={(diameter) =>
              changeBrush({
                ...brush,
                mode: isFeatureBrush(brush.mode) ? "land" : brush.mode,
                radius: diameter / 2,
              })
            }
          />
          <TerrainBrushInfo info={terrainBrushInfo} />
          <NumberField
            label="Absenkung (Fuß)"
            value={brush.amount}
            min={0.1}
            max={100}
            step={0.1}
            onChange={(amount) => changeBrush({ ...brush, amount })}
          />
          <small>
            Ziehen: Gewässer malen · Loslassen: Übernehmen · Escape: Abbrechen.
            Bestehendes Wasser bestimmt den Pegel. Mit Höhenwerkzeugen Inseln
            und Küsten formen.
          </small>
        </>
      )}
      {tool === "terrain" && (
        <>
          <SelectField
            label="Pinselmodus"
            value={brush.mode}
            options={{
              land: "Land",
              sea: "Meer",
              mountains: "Bergkette",
              hills: "Hügel",
              canyon: "Schlucht",
              raise: "Anheben",
              lower: "Absenken",
              smooth: "Glätten",
              flatten: "Einebnen",
            }}
            onChange={(mode) => {
              if (isFeatureBrush(mode)) {
                const next = featurePreset(brush, mode, 1);
                changeBrush(next);
                focusTerrainBrush(next.radius);
              } else
                changeBrush({
                  ...brush,
                  mode,
                  radius: isFeatureBrush(brush.mode) ? 40 : brush.radius,
                });
            }}
          />
          {(brush.mode === "land" || brush.mode === "sea") && (
            <>
              <SelectField
                label="Küstenform"
                value={(brush.roughness ?? 0) > 0 ? "crinkled" : "round"}
                options={{ round: "Rund", crinkled: "Kräuselig" }}
                onChange={(shape) =>
                  changeBrush({
                    ...brush,
                    roughness: shape === "crinkled" ? 0.65 : 0,
                  })
                }
              />
              {(brush.roughness ?? 0) > 0 && (
                <label>
                  Küstenrauheit: {Math.round(brush.roughness! * 100)} %
                  <input
                    type="range"
                    aria-label="Küstenrauheit"
                    min={5}
                    max={100}
                    step={5}
                    value={Math.round(brush.roughness! * 100)}
                    onChange={(event) =>
                      changeBrush({
                        ...brush,
                        roughness: Number(event.target.value) / 100,
                      })
                    }
                  />
                  <small>
                    Unregelmäßige Buchten und Landzungen innerhalb des
                    Pinselkreises.
                  </small>
                </label>
              )}
            </>
          )}
          {isFeatureBrush(brush.mode) ? (
            <>
              <SelectField
                label="Geländegröße"
                value={String(featureIndex)}
                options={{
                  ...(featureIndex === -1 ? { "-1": "Eigene Größe" } : {}),
                  ...Object.fromEntries(
                    featurePresets[brush.mode].map((p, i) => [
                      String(i),
                      p.label,
                    ]),
                  ),
                }}
                onChange={(index) => {
                  if (index === "-1" || !isFeatureBrush(brush.mode)) return;
                  const next = featurePreset(brush, brush.mode, Number(index));
                  changeBrush(next);
                  focusTerrainBrush(next.radius);
                }}
              />
              <NumberField
                label="Breite (Meter)"
                value={Math.round(brush.radius * 2 * metres)}
                min={10}
                max={200000}
                onChange={(width) =>
                  changeBrush({ ...brush, radius: width / (2 * metres) })
                }
              />
              <NumberField
                label={
                  brush.mode === "canyon"
                    ? "Relieftiefe (Meter)"
                    : "Reliefhöhe (Meter)"
                }
                value={Math.round((brush.featureHeight ?? 100) * metres)}
                min={1}
                max={9000}
                onChange={(height) =>
                  changeBrush({ ...brush, featureHeight: height / metres })
                }
              />
              <button onClick={() => focusTerrainBrush(brush.radius)}>
                Auf Pinselgröße zoomen
              </button>
              <small>
                Breite bleibt beim Zoomen gleich. Relief pro Zug, abhängig von
                Form und Überlappung. Erneutes Übermalen verstärkt das Gelände.
                {brush.mode === "canyon"
                  ? " Unter dem Meeresspiegel erscheint Wasser."
                  : ""}
              </small>
            </>
          ) : (
            <NumberField
              label="Pinselgröße (Pixel)"
              value={brush.radius * 2}
              min={8}
              max={512}
              onChange={(radius) =>
                changeBrush({ ...brush, radius: radius / 2 })
              }
            />
          )}
          <TerrainBrushInfo info={terrainBrushInfo} />
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
          <label className="atlas-checkbox">
            <input
              type="checkbox"
              checked={contours}
              onChange={(e) => changeContours(e.target.checked)}
            />
            Höhenlinien
          </label>
          <small>
            Ziehen: Direkt malen · Loslassen / Escape: Strich beenden ·
            Rückgängig: Strich entfernen
          </small>
        </>
      )}
      {tool === "road" && (
        <>
          <div className="atlas-field-pair">
            {!extending && (
              <NumberField
                label="Straßenbreite (Fuß)"
                value={roadWidth}
                min={2}
                max={100}
                onChange={changeRoadWidth}
              />
            )}
            <SelectField
              label="Material"
              value={material}
              disabled={extending}
              options={{ earth: "Erde", stone: "Stein" }}
              onChange={changeMaterial}
            />
          </div>
          <div
            className="atlas-field-pair"
            title="Start und Ziel bleiben fest. Zwischenpunkte dürfen innerhalb ihres Spielraums ausweichen."
          >
            <label className="atlas-checkbox">
              <input
                type="checkbox"
                checked={!!tools.terrainFollow}
                onChange={(e) =>
                  tools.changeTerrainFollow(
                    e.target.checked ? { tolerance: 0.1 } : undefined,
                  )
                }
              />
              Gelände folgen
            </label>
            {tools.terrainFollow && (
              <NumberField
                label="Spielraum (%)"
                value={tools.terrainFollow.tolerance * 100}
                min={0}
                max={30}
                onChange={(v) =>
                  tools.changeTerrainFollow({ tolerance: v / 100 })
                }
              />
            )}
          </div>
          <RoughnessControls
            value={roughness}
            onChange={changeRoughness}
            onVariation={newVariation}
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
      {tool === "area" && <GroundControls tools={tools} />}
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

const brushNumber = new Intl.NumberFormat("de-DE", {
  maximumSignificantDigits: 3,
});
function brushDistance(feet: number) {
  const meters = feet * metres;
  return meters >= 1000
    ? `${brushNumber.format(meters / 1000)} km`
    : `${brushNumber.format(meters)} m`;
}
function TerrainBrushInfo({
  info,
}: {
  info: ReturnType<typeof projectTerrainBrushInfo>;
}) {
  if (!info) return null;
  return (
    <>
      <small>
        Durchmesser: {brushDistance(info.diameter)} · Höhenraster:{" "}
        {brushDistance(info.spacing)}
      </small>
      {info.subgrid && (
        <small>
          Kleine Pinsel können zwischen den Rasterpunkten ohne Höhenänderung
          bleiben. Pinsel vergrößern oder den Strich versetzen.
        </small>
      )}
    </>
  );
}
