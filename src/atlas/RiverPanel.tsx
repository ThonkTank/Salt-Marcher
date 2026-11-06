import { NumberField, Rename } from "./Fields";
import type { RiversEditor } from "./useRivers";
export function RiverPanel({
  editor: e,
  disabled,
}: {
  editor: RiversEditor;
  disabled: boolean;
}) {
  const nodes = e.draft?.nodes ?? e.river?.nodes ?? [],
    current = e.node === null ? undefined : nodes[e.node];
  return (
    <div className="atlas-tool-options">
      <h2>Fluss</h2>
      <fieldset
        className="atlas-river-controls"
        disabled={disabled || !e.editable || e.busy}
      >
        <button onClick={e.newRiver}>Neuen Fluss zeichnen</button>
        <button
          aria-pressed={e.mode === "select"}
          onClick={() => e.chooseMode("select")}
        >
          Fluss auswählen
        </button>
        {(e.river || e.draft) && (
          <Rename
            label="Flussname"
            name={e.draft?.name ?? e.river?.name ?? "Fluss"}
            onChange={e.setName}
          />
        )}
        <NumberField
          label="Flussbreite (Fuß)"
          value={current?.width ?? e.width}
          min={2}
          max={1000}
          onChange={e.setWidth}
        />
        <NumberField
          label="Geländespielraum (%)"
          value={e.settings.tolerance * 100}
          min={0}
          max={30}
          onChange={(v) => e.changeSettings({ tolerance: v / 100 })}
        />
        <NumberField
          label="Windungsstärke (%)"
          value={e.settings.roughness * 100}
          min={0}
          max={100}
          onChange={(v) => e.changeSettings({ roughness: v / 100 })}
        />
        <NumberField
          label="Mäanderweite (Fuß)"
          value={e.settings.meander}
          min={0}
          max={10000}
          onChange={(v) => e.changeSettings({ meander: v })}
        />
        <label className="atlas-checkbox">
          <input
            type="checkbox"
            checked={e.settings.sourceFade}
            onChange={(v) => e.changeSettings({ sourceFade: v.target.checked })}
          />{" "}
          Schmale Quelle
        </label>
        <button
          onClick={() =>
            e.changeSettings({ seed: (e.settings.seed + 1) >>> 0 })
          }
        >
          Andere Flusswindungen
        </button>
        {!!nodes.length && (
          <>
            <button onClick={e.reverse}>Richtung umkehren</button>
            <label>
              Verlaufspunkt
              <select
                aria-label="Flusspunkt"
                value={e.node ?? ""}
                onChange={(v) => e.setNode(Number(v.target.value))}
              >
                {nodes.map((n, i) => (
                  <option key={i} value={i}>
                    {i + 1}
                    {i === 0
                      ? " · Quelle"
                      : i === nodes.length - 1
                        ? " · Mündung"
                        : ""}
                    {n.id ? "" : " · neu"}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={e.node === null || e.node >= nodes.length - 1}
              onClick={e.insertNode}
            >
              Punkt danach einfügen
            </button>
            <button
              disabled={e.node === null || nodes.length <= 2}
              onClick={e.deleteNode}
            >
              Punkt entfernen
            </button>
          </>
        )}
        {e.river && (
          <>
            <button onClick={() => e.extend("start")}>Quelle verlängern</button>
            <button onClick={() => e.extend("end")}>Mündung verlängern</button>
            <button className="text-danger" onClick={() => void e.remove()}>
              Fluss löschen
            </button>
          </>
        )}
      </fieldset>
      {e.draft && (
        <>
          {e.preview?.valid ? (
            <p>
              Maximaler Einschnitt: {e.maxCut.toFixed(1)} Fuß. Orange ab 10, Rot
              ab 30 Fuß.
            </p>
          ) : !e.error && e.draft.nodes.length >= 2 ? (
            <p>Flussvorschau wird berechnet …</p>
          ) : null}
          <button
            disabled={
              disabled || !e.editable || e.busy || e.draft.nodes.length < 2
            }
            onClick={() => void e.accept()}
          >
            Fluss übernehmen
          </button>
          <button disabled={e.busy} onClick={e.cancel}>
            Entwurf abbrechen
          </button>
        </>
      )}
      {e.error && (
        <p role="alert">
          {e.error} <button onClick={e.retry}>Erneut laden</button>
        </p>
      )}
      <p>
        Klicken setzt Punkte. Enter oder Rechtsklick übernimmt. Punkte ziehen
        zum Bearbeiten. Pfeile zeigen die Fließrichtung; Anschlüsse verbinden
        Nebenflüsse.
      </p>
    </div>
  );
}
