import { RoughnessControls } from "./RoughnessControls";
import type { RoadRoughness } from "./generated/RoadRoughness";
import {
  roadEditInput,
  changeRoadProperties,
  setRoadHandles,
  areaInput,
  type RoadEditDraft,
} from "./roadDraft";
import { memo, type ReactNode } from "react";
import { NumberField, Rename, SelectField } from "./Fields";
import type {
  Detail,
  EditorContext,
  OwnerState,
  Parcel,
  House,
  Intent,
  MapObject,
} from "./model";
import { rotateParcelHouse } from "./parcelEditor";
const ObjectList = memo(function ObjectList({
  objects,
  selected,
  onSelect,
}: {
  objects: MapObject[];
  selected: string;
  onSelect: (o: MapObject) => void;
}) {
  return (
    <>
      {objects
        .filter(
          (o) => o.kind === "house" || o.kind === "road" || o.kind === "parcel",
        )
        .map((o) => (
          <button
            key={o.id}
            aria-pressed={selected === o.id}
            onClick={() => onSelect(o)}
          >
            {o.kind === "house" ? "⌂" : o.kind === "road" ? "↝" : "▱"}{" "}
            {o.kind === "parcel" ? "Parzelle" : o.name}
          </button>
        ))}
    </>
  );
});
export function Inspector({
  parcelEditor,
  selectedObject,
  roadEdit,
  active,
  context,
  parcel,
  ownerState,
  onOpenParcel,
  detail,
  room,
  connection,
  lower,
  nodeSelection,
  objects,
  selected,
  onSelectObject,
  apply,
  onLeave,
  onOpenHouse,
  onRoughen,
  roughening,
  onRoughness,
  onVariation,
  overview,
  onPopulate,
  onExtend,
  onDeleteSelection,
  onDeleteObject,
  onLower,
  onSelectRoom,
  onSelectConnection,
  onOtherFloor,
}: {
  parcelEditor?: ReactNode;
  selectedObject: MapObject | undefined;
  roadEdit: RoadEditDraft | null;
  active: string;
  context: EditorContext;
  parcel: Parcel | undefined;
  ownerState: OwnerState | undefined;
  onOpenParcel: (parcel: Parcel) => void;
  detail: Detail | null | undefined;
  room: string;
  connection: string;
  lower: boolean;
  nodeSelection: string | number | null;
  objects: MapObject[];
  selected: string;
  onSelectObject: (o: MapObject) => void;
  apply: (
    intent: Extract<
      Intent,
      {
        type:
          | "rename"
          | "roof"
          | "importantPlace"
          | "setFoundation"
          | "transformHouse"
          | "updateRoad"
          | "updateArea"
          | "room"
          | "connection"
          | "detachParcel";
      }
    >,
  ) => Promise<unknown>;
  onLeave: () => void;
  onOpenHouse: (house: House) => void;
  onRoughen?: () => void;
  roughening?: RoadRoughness | null;
  onRoughness?: (amount: number) => void;
  onVariation?: () => void;
  overview?: boolean;
  onPopulate: () => void;
  onExtend: (end: "start" | "end") => void;
  onDeleteSelection: () => void;
  onDeleteObject: () => void;
  onLower: (value: boolean) => void;
  onSelectRoom: (id: string, floor: number) => void;
  onSelectConnection: (id: string, floor: number) => void;
  onOtherFloor: (floor: number) => void;
}) {
  const selectedRoom = detail?.rooms.find((r) => r.id === room),
    selectedConnection = detail?.connections.find((c) => c.id === connection);
  return (
    <div className="atlas-inspector-content">
      <div className="eyebrow">AUSWAHL</div>
      {selectedObject && (
        <>
          <h2>
            {
              {
                house: "Gebäude",
                road: "Straße",
                area: "Flächen",
                scenery: "Landschaftsstrich",
                parcel: "Parzelle",
              }[selectedObject.kind]
            }
          </h2>
          {(selectedObject.kind === "house" ||
            selectedObject.kind === "road") && (
            <Rename
              key={selectedObject.id}
              name={selectedObject.name}
              label="Name"
              onChange={(name) =>
                void apply({ type: "rename", id: selectedObject.id, name })
              }
            />
          )}
          {selectedObject.kind === "house" && (
            <>
              <button
                className="atlas-primary"
                onClick={() =>
                  active === selectedObject.id
                    ? onLeave()
                    : onOpenHouse(selectedObject)
                }
              >
                {active === selectedObject.id
                  ? "Haus schließen"
                  : "Innen öffnen"}
              </button>
              <NumberField
                label="Fundamenthöhe (Fuß)"
                value={selectedObject.foundation.height}
                min={0}
                max={100}
                onChange={(height) =>
                  void apply({
                    type: "setFoundation",
                    id: selectedObject.id,
                    foundation: { ...selectedObject.foundation, height },
                  })
                }
              />
              <NumberField
                label="Geländeübergang (Fuß)"
                value={selectedObject.foundation.transition}
                min={0}
                max={500}
                onChange={(transition) =>
                  void apply({
                    type: "setFoundation",
                    id: selectedObject.id,
                    foundation: { ...selectedObject.foundation, transition },
                  })
                }
              />
              <label className="atlas-checkbox">
                <input
                  type="checkbox"
                  checked={selectedObject.importantPlace}
                  onChange={(e) =>
                    void apply({
                      type: "importantPlace",
                      id: selectedObject.id,
                      value: e.target.checked,
                    })
                  }
                />
                Wichtiger Ort
              </label>
              <label>
                Dachfarbe
                <input
                  type="color"
                  aria-label="Dachfarbe"
                  value={selectedObject.roof}
                  onChange={(e) =>
                    void apply({
                      type: "roof",
                      id: selectedObject.id,
                      roof: e.target.value,
                    })
                  }
                />
              </label>
              {ownerState?.parcelId && parcel && (
                <>
                  <p>Gebunden an eine Parzelle · gemeinsames 5-Fuß-Raster</p>
                  <button onClick={() => onOpenParcel(parcel)}>
                    Parzelle öffnen
                  </button>
                </>
              )}
              {context.kind === "exterior" &&
                (selectedObject.placement.kind === "parcel" ? (
                  <>
                    <button
                      disabled={!parcel}
                      onClick={() =>
                        parcel &&
                        void apply({
                          type: "transformHouse",
                          id: selectedObject.id,
                          transform: rotateParcelHouse(
                            selectedObject,
                            parcel,
                            -1,
                          ),
                        })
                      }
                    >
                      90° links
                    </button>
                    <button
                      disabled={!parcel}
                      onClick={() =>
                        parcel &&
                        void apply({
                          type: "transformHouse",
                          id: selectedObject.id,
                          transform: rotateParcelHouse(
                            selectedObject,
                            parcel,
                            1,
                          ),
                        })
                      }
                    >
                      90° rechts
                    </button>
                    <p>Zellweise im Parzellenraster verschieben.</p>
                  </>
                ) : (
                  <>
                    <NumberField
                      label="Drehung (Grad)"
                      value={
                        Math.round(
                          ((selectedObject.transform.angle * 180) / Math.PI) *
                            100,
                        ) / 100
                      }
                      step={1}
                      onChange={(v) =>
                        void apply({
                          type: "transformHouse",
                          id: selectedObject.id,
                          transform: {
                            ...selectedObject.transform,
                            angle: (v * Math.PI) / 180,
                          },
                        })
                      }
                    />
                    <p>Am gelben Griff frei drehen.</p>
                  </>
                ))}
            </>
          )}
          {selectedObject.kind === "parcel" && (
            <>
              {parcelEditor}
              <button
                className="atlas-primary"
                onClick={() =>
                  context.kind === "parcel" &&
                  context.parcelId === selectedObject.id
                    ? onLeave()
                    : onOpenParcel(selectedObject)
                }
              >
                {context.kind === "parcel" &&
                context.parcelId === selectedObject.id
                  ? "Parzelle schließen"
                  : "Parzelle öffnen"}
              </button>
              <p>
                {ownerState?.houseId
                  ? "Bebaut · Räume im vorhandenen Haus ergänzen"
                  : "Leere Parzelle · Räume im gemeinsamen 5-Fuß-Raster zeichnen"}
              </p>
              <p>
                {selectedObject.source.kind === "road"
                  ? "An Straße gebunden"
                  : "Von Straße gelöst · Raster eingefroren"}
              </p>
              {selectedObject.source.kind === "road" && (
                <button
                  onClick={() =>
                    void apply({ type: "detachParcel", id: selectedObject.id })
                  }
                >
                  Parzelle von Straße lösen
                </button>
              )}
            </>
          )}
          {selectedObject.kind === "road" && (
            <>
              <NumberField
                label="Breite (Fuß)"
                value={roadEdit?.width ?? selectedObject.width}
                min={2}
                max={100}
                onChange={(v) =>
                  void apply({
                    type: "updateRoad",
                    roadId: selectedObject.id,
                    road: roadEditInput(
                      changeRoadProperties(roadEdit ?? selectedObject, {
                        width: v,
                      }),
                    ),
                  })
                }
              />
              <SelectField
                label="Straßenmaterial"
                value={roadEdit?.material ?? selectedObject.material}
                options={{ earth: "Erde", stone: "Stein" }}
                onChange={(material) =>
                  void apply({
                    type: "updateRoad",
                    roadId: selectedObject.id,
                    road: roadEditInput(
                      changeRoadProperties(roadEdit ?? selectedObject, {
                        material,
                      }),
                    ),
                  })
                }
              />
              {roughening && onRoughness && onVariation ? (
                <RoughnessControls
                  value={roughening}
                  onChange={onRoughness}
                  onVariation={onVariation}
                />
              ) : (
                <button onClick={onRoughen}>Verlauf aufrauen</button>
              )}
              <button className="atlas-primary" onClick={onPopulate}>
                Straße bebauen
              </button>
              <button onClick={() => onExtend("start")}>
                Am Anfang verlängern
              </button>
              <button onClick={() => onExtend("end")}>
                Am Ende verlängern
              </button>
              {nodeSelection !== null && !roughening && (
                <>
                  {!overview && (
                    <button
                      onClick={() => {
                        const r = setRoadHandles(
                          roadEdit ?? selectedObject,
                          String(nodeSelection),
                          true,
                        );
                        void apply({
                          type: "updateRoad",
                          roadId: selectedObject.id,
                          road: roadEditInput(r),
                        });
                      }}
                    >
                      Kurvengriffe anlegen
                    </button>
                  )}
                  {!overview && (
                    <button
                      onClick={() => {
                        const r = setRoadHandles(
                          roadEdit ?? selectedObject,
                          String(nodeSelection),
                          false,
                        );
                        void apply({
                          type: "updateRoad",
                          roadId: selectedObject.id,
                          road: roadEditInput(r),
                        });
                      }}
                    >
                      Griffe entfernen
                    </button>
                  )}
                  <button onClick={onDeleteSelection}>
                    Verlaufspunkt löschen
                  </button>
                </>
              )}
            </>
          )}
          {selectedObject.kind === "area" && (
            <>
              <SelectField
                label="Flächenmaterial"
                value={selectedObject.material}
                options={{
                  grass: "grass",
                  earth: "earth",
                  stone: "stone",
                  water: "water",
                }}
                onChange={(material) =>
                  void apply({
                    type: "updateArea",
                    areaId: selectedObject.id,
                    area: areaInput({ ...selectedObject, material }),
                  })
                }
              />
              {nodeSelection !== null && (
                <button onClick={onDeleteSelection}>Eckpunkt löschen</button>
              )}
            </>
          )}
          <button className="text-danger" onClick={onDeleteObject}>
            Objekt löschen
          </button>
        </>
      )}
      {context.kind !== "exterior" && (
        <label className="atlas-checkbox">
          <input
            type="checkbox"
            checked={lower}
            onChange={(e) => onLower(e.target.checked)}
          />
          Untere Geschosse anzeigen
        </label>
      )}
      {active && detail && (
        <>
          <h2>Räume</h2>
          {detail.rooms.map((r) => (
            <button
              key={r.id}
              aria-pressed={room === r.id}
              onClick={() => onSelectRoom(r.id, r.floor)}
            >
              {r.name} · G {r.floor}
            </button>
          ))}
          {selectedRoom && (
            <Rename
              key={selectedRoom.id}
              label="Raumname"
              name={selectedRoom.name}
              onChange={(name) =>
                void apply({
                  type: "room",
                  buildingId: active,
                  intent: { kind: "rename", roomId: selectedRoom.id, name },
                })
              }
            />
          )}
          <h2>Verbindungen</h2>
          {detail.connections.map((c) => (
            <button
              key={c.id}
              aria-pressed={connection === c.id}
              onClick={() => onSelectConnection(c.id, c.floor)}
            >
              {c.type === "stairs"
                ? "Treppe"
                : c.kind === "door"
                  ? "Tür"
                  : "Durchgang"}{" "}
              · G {c.floor}
            </button>
          ))}
          {selectedConnection && (
            <>
              {selectedConnection.type === "stairs" ? (
                <button onClick={() => onOtherFloor(selectedConnection.floor)}>
                  Zur anderen Seite
                </button>
              ) : (
                <button
                  onClick={() =>
                    void apply({
                      type: "connection",
                      buildingId: active,
                      intent: {
                        action: "convert",
                        connectionId: selectedConnection.id,
                        kind:
                          selectedConnection.kind === "door"
                            ? "passage"
                            : "door",
                      },
                    })
                  }
                >
                  Tür / Durchgang umwandeln
                </button>
              )}
              <button onClick={onDeleteSelection}>Verbindung löschen</button>
            </>
          )}
        </>
      )}
      <details className="atlas-object-list">
        <summary>Objekte im Ausschnitt</summary>
        <ObjectList
          objects={objects}
          selected={selected}
          onSelect={onSelectObject}
        />
      </details>
    </div>
  );
}
