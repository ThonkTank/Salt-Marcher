import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Level } from "./model";
export function LevelPanel({
  levels,
  active,
  onSelect,
  onAdd,
  onMove,
  onRename,
  onDelete,
}: {
  levels: Level[];
  active: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onMove: (d: -1 | 1) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const index = levels.findIndex((l) => l.id === active);
  return (
    <section className="level-panel">
      <div className="section-heading">
        <h2>Geschosse</h2>
        <button
          aria-label="Geschoss hinzufügen"
          title="Oberhalb einfügen"
          onClick={onAdd}
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="level-list">
        {[...levels].reverse().map((l) => (
          <button
            key={l.id}
            className={`level-row ${l.id === active ? "selected" : ""}`}
            aria-pressed={l.id === active}
            onClick={() => onSelect(l.id)}
          >
            {l.name}
          </button>
        ))}
      </div>
      <div className="level-actions">
        <button
          aria-label="Geschoss nach oben"
          disabled={index === levels.length - 1}
          onClick={() => onMove(1)}
        >
          <ArrowUp size={17} />
        </button>
        <button
          aria-label="Geschoss nach unten"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowDown size={17} />
        </button>
        <button aria-label="Geschoss umbenennen" onClick={onRename}>
          <Pencil size={17} />
        </button>
        <button
          aria-label="Geschoss löschen"
          disabled={levels.length === 1}
          onClick={onDelete}
        >
          <Trash2 size={17} />
        </button>
      </div>
    </section>
  );
}
