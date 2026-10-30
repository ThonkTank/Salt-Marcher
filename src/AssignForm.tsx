import { useState } from "react";
import { Level } from "./model";
export function AssignForm({
  level,
  onSubmit,
}: {
  level: Level;
  onSubmit: (target?: string, name?: string) => void;
}) {
  const [target, setTarget] = useState("new"),
    [name, setName] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(target === "new" ? undefined : target, name || undefined);
      }}
    >
      <label>
        Zuweisen zu
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="new">Neuer Raum</option>
          {level.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      {target === "new" && (
        <label>
          Name des neuen Raums
          <input
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Automatisch vergeben"
          />
        </label>
      )}
      <div className="modal-actions">
        <button className="primary">Zuordnung übernehmen</button>
      </div>
    </form>
  );
}
