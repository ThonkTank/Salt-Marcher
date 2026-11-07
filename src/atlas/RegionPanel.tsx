import { useState } from "react";
import { NumberField, Rename, SelectField } from "./Fields";
import { Modal } from "../Modal";
import type { RegionsEditor } from "./useRegions";
import type { RegionAction } from "./generated/RegionAction";
export function RegionPanel({
  editor: e,
  disabled,
}: {
  editor: RegionsEditor;
  disabled: boolean;
}) {
  const [confirmation, setConfirmation] = useState<{
    action: RegionAction;
    message: string;
    revision: number | undefined;
  } | null>(null);
  const c = e.catalog,
    cat = e.category,
    rank = e.rank,
    r = e.region;
  const [newName, setNewName] = useState("Neue Region");
  if (!c)
    return (
      <div>
        Regionen werden geladen …{" "}
        {e.error && (
          <p role="alert">
            {e.error}
            <button onClick={e.retry}>Erneut laden</button>
          </p>
        )}
      </div>
    );
  const save = (next: typeof c) => e.action({ kind: "catalog", catalog: next });
  const move = (kind: "categories" | "ranks", id: string, delta: number) => {
    const entries = [...c[kind]],
      i = entries.findIndex((x) => x.id === id);
    let j = i + delta;
    if (kind === "ranks") {
      while (
        j >= 0 &&
        j < entries.length &&
        "categoryId" in entries[j] &&
        (entries[j] as (typeof c.ranks)[number]).categoryId !== cat?.id
      )
        j += delta;
    }
    if (j < 0 || j >= entries.length) return;
    [entries[i], entries[j]] = [entries[j], entries[i]];
    save({ ...c, [kind]: entries });
  };
  return (
    <div className="atlas-settings region-panel">
      <h2>Regionen</h2>
      {e.error && (
        <p role="alert">
          {e.error}
          <button onClick={e.retry}>Erneut laden</button>
        </p>
      )}
      <fieldset disabled={disabled}>
        <SelectField
          label="Kategorie"
          value={cat?.id ?? ""}
          options={Object.fromEntries(c.categories.map((c) => [c.id, c.name]))}
          onChange={e.chooseCategory}
        />
        <SelectField
          label="Rangstufe"
          value={rank?.id ?? ""}
          options={Object.fromEntries(e.ranks.map((r) => [r.id, r.name]))}
          onChange={e.chooseRank}
        />
        <SelectField
          label="Regionsmodus"
          value={e.mode}
          options={{
            paint: "Malen",
            erase: "Radieren",
            select: "Auswählen",
            label: "Namensposition setzen",
          }}
          onChange={e.setMode}
        />
        <NumberField
          label="Pinselgröße (Pixel)"
          value={e.diameter}
          min={8}
          max={512}
          onChange={e.setDiameter}
        />
        <label>
          Name der neuen Region
          <input
            aria-label="Name der neuen Region"
            value={newName}
            maxLength={240}
            onChange={(v) => setNewName(v.target.value)}
          />
        </label>
        <button
          disabled={!rank || !newName.trim() || [...newName].length > 120}
          onClick={() =>
            rank && e.action({ kind: "create", name: newName, rankId: rank.id })
          }
        >
          Neue Region
        </button>
        <div
          className="region-list"
          role="group"
          aria-label="Regionen dieser Rangstufe"
        >
          {e.summaries
            .filter((r) => r.rankId === rank?.id)
            .map((s) => (
              <button
                key={s.id}
                aria-pressed={e.selected === s.id}
                onClick={() => e.select(s.id)}
              >
                {s.name}
                {s.area === 0 ? " · leer" : ""}
              </button>
            ))}
        </div>
        {!e.selected && (
          <small>Region auswählen oder anlegen, dann ihre Fläche malen.</small>
        )}
        {r && (
          <>
            <Rename
              label="Regionsname"
              name={r.name}
              onChange={(name) => e.update({ name })}
            />
            <SelectField
              label="Region zuordnen"
              value={r.rankId}
              options={Object.fromEntries(
                c.ranks.map((rank) => [
                  rank.id,
                  `${c.categories.find((c) => c.id === rank.categoryId)?.name} · ${rank.name}`,
                ]),
              )}
              onChange={(rankId) => e.update({ rankId })}
            />
            <label>
              Regionsfarbe
              <input
                aria-label="Regionsfarbe"
                type="color"
                value={r.style.color}
                onChange={(v) =>
                  e.update({ style: { ...r.style, color: v.target.value } })
                }
              />
            </label>
            <NumberField
              label="Fülltransparenz (%)"
              value={Math.round((1 - r.style.opacity) * 100)}
              min={0}
              max={100}
              onChange={(v) =>
                e.update({ style: { ...r.style, opacity: 1 - v / 100 } })
              }
            />
            <NumberField
              label="Randbreite (Pixel)"
              value={r.style.width}
              min={0.5}
              max={12}
              step={0.5}
              onChange={(width) => e.update({ style: { ...r.style, width } })}
            />
            <SelectField
              label="Randstil"
              value={r.style.dash}
              options={{
                solid: "Durchgezogen",
                dashed: "Gestrichelt",
                dotted: "Gepunktet",
              }}
              onChange={(dash) => e.update({ style: { ...r.style, dash } })}
            />
            <details>
              <summary>Beschriftung</summary>
              <p>
                „Namensposition setzen“ platziert den Namen mit einem Klick auf
                die Karte.
              </p>
              <NumberField
                label="Name ab Zoom (%)"
                value={((r.label.minScale ?? 0.000064) / 6.4) * 100}
                min={0.001}
                step={0.1}
                onChange={(v) =>
                  e.update({ label: { ...r.label, minScale: (v * 6.4) / 100 } })
                }
              />
              <NumberField
                label="Name bis Zoom (%)"
                value={((r.label.maxScale ?? 64) / 6.4) * 100}
                min={0.001}
                step={0.1}
                onChange={(v) =>
                  e.update({ label: { ...r.label, maxScale: (v * 6.4) / 100 } })
                }
              />
              <button
                onClick={() =>
                  e.update({
                    label: { anchor: null, minScale: null, maxScale: null },
                  })
                }
              >
                Beschriftung automatisch
              </button>
            </details>
            {[true, false].map((higher) => (
              <details key={String(higher)} open>
                <summary>
                  {higher
                    ? "Übergeordnete Regionen"
                    : "Untergeordnete Regionen"}
                </summary>
                {c.ranks.map((rank) => {
                  const links = e.relations.filter(
                    (x) => x.higher === higher && x.region.rankId === rank.id,
                  );
                  return links.length ? (
                    <div key={rank.id}>
                      <strong>{rank.name}</strong>
                      {links.map((x) => (
                        <button
                          key={x.region.id}
                          onClick={() => e.select(x.region.id)}
                        >
                          {x.region.name} · {(x.fraction * 100).toFixed(1)} %
                        </button>
                      ))}
                    </div>
                  ) : null;
                })}
              </details>
            ))}
            <button
              className="text-danger"
              onClick={() =>
                setConfirmation({
                  revision: e.data?.status.revision,
                  action: { kind: "delete", id: r.id },
                  message: `„${r.name}“ löschen? Räumlich zugeordnete Regionen bleiben erhalten.`,
                })
              }
            >
              Region löschen
            </button>
          </>
        )}
        <details>
          <summary>Kategorien und Rangstufen verwalten</summary>
          {cat && (
            <>
              <Rename
                label="Kategoriename"
                name={cat.name}
                onChange={(name) =>
                  save({
                    ...c,
                    categories: c.categories.map((x) =>
                      x.id === cat.id ? { ...x, name } : x,
                    ),
                  })
                }
              />
              <label>
                <input
                  type="checkbox"
                  checked={cat.visible}
                  onChange={(v) =>
                    save({
                      ...c,
                      categories: c.categories.map((x) =>
                        x.id === cat.id
                          ? { ...x, visible: v.target.checked }
                          : x,
                      ),
                    })
                  }
                />
                Kategorie sichtbar
              </label>
              <SelectField
                label="Anzeige der Kategorie"
                value={cat.fixedRank ?? "auto"}
                options={{
                  auto: "Automatisch nach Zoom",
                  ...Object.fromEntries(e.ranks.map((r) => [r.id, r.name])),
                }}
                onChange={(v) =>
                  save({
                    ...c,
                    categories: c.categories.map((x) =>
                      x.id === cat.id
                        ? { ...x, fixedRank: v === "auto" ? null : v }
                        : x,
                    ),
                  })
                }
              />
              <label>
                <input
                  type="checkbox"
                  checked={cat.markers ?? false}
                  onChange={(event) =>
                    save({
                      ...c,
                      categories: c.categories.map((x) =>
                        x.id === cat.id
                          ? { ...x, markers: event.target.checked }
                          : x,
                      ),
                    })
                  }
                />{" "}
                Kleine Regionen als Ortssymbole
              </label>
              <div>
                <button onClick={() => move("categories", cat.id, -1)}>
                  Kategorie ↑
                </button>
                <button onClick={() => move("categories", cat.id, 1)}>
                  Kategorie ↓
                </button>
              </div>
              <button
                className="text-danger"
                onClick={() =>
                  setConfirmation({
                    revision: e.data?.status.revision,
                    action: { kind: "deleteCategory", id: cat.id },
                    message: `Kategorie „${cat.name}“ mit ${e.ranks.length} Rangstufen und ${e.summaries.filter((s) => e.ranks.some((r) => r.id === s.rankId)).length} Regionen löschen?`,
                  })
                }
              >
                Kategorie löschen
              </button>
            </>
          )}
          <button
            onClick={() =>
              e.action({ kind: "addCategory", name: "Eigene Kategorie" })
            }
          >
            Kategorie hinzufügen
          </button>
          {rank && (
            <>
              <Rename
                label="Rangname"
                name={rank.name}
                onChange={(name) =>
                  save({
                    ...c,
                    ranks: c.ranks.map((x) =>
                      x.id === rank.id ? { ...x, name } : x,
                    ),
                  })
                }
              />
              <div>
                <button onClick={() => move("ranks", rank.id, -1)}>
                  Rang kleiner
                </button>
                <button onClick={() => move("ranks", rank.id, 1)}>
                  Rang größer
                </button>
              </div>
              <button
                className="text-danger"
                onClick={() =>
                  setConfirmation({
                    revision: e.data?.status.revision,
                    action: { kind: "deleteRank", id: rank.id },
                    message: `Rangstufe „${rank.name}“ und ihre ${e.summaries.filter((r) => r.rankId === rank.id).length} Regionen löschen?`,
                  })
                }
              >
                Rangstufe löschen
              </button>
            </>
          )}
          <button
            disabled={!cat}
            onClick={() =>
              cat &&
              e.action({
                kind: "addRank",
                categoryId: cat.id,
                name: "Neue Rangstufe",
              })
            }
          >
            Rangstufe hinzufügen
          </button>
        </details>
        <small>
          Ziehen: Malen · Loslassen: Übernehmen · Escape: Abbrechen. Übermalen
          überträgt Gebiet derselben Rangstufe.
        </small>
      </fieldset>
      {confirmation && (
        <Modal title="Regionen löschen" onClose={() => setConfirmation(null)}>
          <p>{confirmation.message}</p>
          {confirmation.revision !== e.data?.status.revision && (
            <p>
              Dokument geändert. Bitte abbrechen und die Löschung erneut öffnen.
            </p>
          )}
          <button
            disabled={
              disabled ||
              !e.fresh ||
              confirmation.revision !== e.data?.status.revision
            }
            onClick={() => {
              e.action(confirmation.action);
              setConfirmation(null);
            }}
          >
            Löschen bestätigen
          </button>
          <button onClick={() => setConfirmation(null)}>Abbrechen</button>
        </Modal>
      )}
    </div>
  );
}
