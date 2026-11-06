import { NumberField } from "./Fields";
import type { EditorTools } from "./useEditorTools";
const hex = (c: number[]) =>
  "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
export function GroundControls({ tools }: { tools: EditorTools }) {
  const { ground: g, changeGround: change } = tools;
  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (v: number) => void,
  ) => (
    <div className="ground-slider">
      <NumberField
        label={label}
        value={value}
        min={min}
        max={max}
        onChange={onChange}
      />
      <input
        aria-label={`${label} Schieberegler`}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
  return (
    <>
      <div
        className="ground-buttons"
        role="group"
        aria-label="Bodenpinselmodus"
      >
        <button
          aria-pressed={g.mode === "paint" && !tools.groundPicker}
          onClick={() => {
            change({ ...g, mode: "paint" });
            tools.changeGroundPicker(false);
          }}
        >
          Malen
        </button>
        <button
          aria-pressed={g.mode === "erase" && !tools.groundPicker}
          onClick={() => {
            change({ ...g, mode: "erase" });
            tools.changeGroundPicker(false);
          }}
        >
          Radieren
        </button>
      </div>
      <div className="ground-buttons" role="group" aria-label="Pinselspitze">
        {(["soft", "hard", "cloud"] as const).map((tip, i) => (
          <button
            key={tip}
            aria-pressed={g.tip === tip}
            onClick={() => change({ ...g, tip })}
          >
            <span className={`ground-tip ${tip}`} aria-hidden="true" />
            {["Weich", "Hart", "Wolkig"][i]}
          </button>
        ))}
      </div>
      {slider("Pinselgröße (Pixel)", g.diameter, 8, 512, (diameter) =>
        change({ ...g, diameter }),
      )}
      {slider("Deckkraft (%)", Math.round(g.opacity * 100), 1, 100, (v) =>
        change({ ...g, opacity: v / 100 }),
      )}
      {slider("Farbfluss (%)", Math.round(g.flow * 100), 1, 100, (v) =>
        change({ ...g, flow: v / 100 }),
      )}
      <div
        className="ground-buttons"
        role="group"
        aria-label="Bodenfarbvorlagen"
      >
        {(
          [
            ["Gras", [157, 181, 139]],
            ["Erde", [200, 185, 155]],
            ["Stein", [170, 169, 163]],
          ] as const
        ).map(([name, color]) => (
          <button
            key={name}
            onClick={() => change({ ...g, color: [...color], mode: "paint" })}
          >
            <span
              className="ground-swatch"
              style={{ background: hex([...color]) }}
            />
            {name}
          </button>
        ))}
      </div>
      <label>
        Bodenfarbe
        <input
          aria-label="Bodenfarbe"
          type="color"
          value={hex(g.color)}
          onChange={(e) => {
            const c = e.target.value;
            change({
              ...g,
              color: [
                parseInt(c.slice(1, 3), 16),
                parseInt(c.slice(3, 5), 16),
                parseInt(c.slice(5, 7), 16),
              ],
              mode: "paint",
            });
          }}
        />
      </label>
      <button
        aria-pressed={tools.groundPicker}
        onClick={() => tools.changeGroundPicker(!tools.groundPicker)}
      >
        Pipette
      </button>
      <small>
        {tools.groundPicker
          ? "Auf den Boden klicken: Farbe aufnehmen."
          : "Ziehen oder halten: malen · Loslassen: übernehmen · Escape: abbrechen. [ / ] oder Alt+Mausrad: Größe."}
      </small>
    </>
  );
}
