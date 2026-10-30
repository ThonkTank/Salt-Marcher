import { useState } from "react";
import { Cell, Level, Room } from "./model";
function RoomName({
  room,
  onRename,
}: {
  room: Room;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(room.name);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onRename(name);
      }}
    >
      <label>
        Raumname
        <input
          value={name}
          maxLength={120}
          required
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={!name.trim() || name.trim() === room.name}
      >
        Name übernehmen
      </button>
    </form>
  );
}
export function RoomPanel({
  level,
  selection,
  onSelect,
  onAssign,
  onRename,
}: {
  level: Level;
  selection: Cell[];
  onSelect: (cells: Cell[]) => void;
  onAssign: () => void;
  onRename: (id: string, name: string) => void;
}) {
  const counts = new Map<string, number>();
  for (const id of Object.values(level.cells))
    counts.set(id, (counts.get(id) ?? 0) + 1);
  const ids = new Set(selection.map((c) => level.cells[c]).filter(Boolean)),
    room = ids.size === 1 ? level.rooms.find((r) => ids.has(r.id)) : undefined;
  return (
    <section className="room-panel">
      <div className="section-heading">
        <h2>Räume</h2>
        <span>{level.rooms.length}</span>
      </div>
      <div className="room-list">
        {level.rooms.map((r, i) => (
          <button
            className={`room-row ${ids.has(r.id) ? "selected" : ""}`}
            key={r.id}
            onClick={() =>
              onSelect(
                (Object.keys(level.cells) as Cell[]).filter(
                  (c) => level.cells[c] === r.id,
                ),
              )
            }
          >
            <span className="room-number">{i + 1}</span>
            <span>
              <strong>{r.name}</strong>
              <small>{counts.get(r.id)} Rasterzellen</small>
            </span>
          </button>
        ))}
      </div>
      {!level.rooms.length && (
        <p className="hint">Ziehe ein Rechteck, um einen Raum zu zeichnen.</p>
      )}
      {room && (
        <RoomName
          key={`${room.id}:${room.name}`}
          room={room}
          onRename={(name) => onRename(room.id, name)}
        />
      )}
      {selection.length > 0 && (
        <button className="wide" onClick={onAssign}>
          Raum zuweisen
        </button>
      )}
    </section>
  );
}
