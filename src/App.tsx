import { useEffect, useReducer, useState } from "react";
import {
  Eraser,
  FolderOpen,
  Hand,
  Map,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  Square,
  Undo2,
  Scan,
  Focus,
} from "lucide-react";
import {
  Atlas,
  addLevel,
  assign,
  deleteLevel,
  getLevel,
  moveLevel,
  renameLevel,
  renameRoom,
} from "./model";
import { editorReducer, initialEditor, isTextInput, Tool } from "./editor";
import { useFiles } from "./useFiles";
import MapCanvas from "./Canvas";
import { LevelPanel } from "./LevelPanel";
import { RoomPanel } from "./RoomPanel";
import { Modal } from "./Modal";
import { AssignForm } from "./AssignForm";
const tools = [
  { id: "draw", name: "Raum zeichnen", key: "r", icon: Square },
  { id: "erase", name: "Radieren", key: "e", icon: Eraser },
  { id: "select", name: "Auswählen", key: "v", icon: MousePointer2 },
  { id: "pan", name: "Verschieben", key: "h", icon: Hand },
] as const;
type Dialog = { kind: "rename"; name: string } | { kind: "delete" | "assign" };
export default function App() {
  const [s, dispatch] = useReducer(editorReducer, undefined, () =>
      initialEditor(),
    ),
    [error, setError] = useState(""),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [focus, setFocus] = useState({ serial: 0, selection: false });
  const files = useFiles(
    s.document,
    (a) => {
      dispatch({ type: "load", document: a });
      setFocus((f) => ({ serial: f.serial + 1, selection: false }));
      setError("");
    },
    setError,
  );
  const level = getLevel(s.document, s.activeLevel),
    index = s.document.levels.indexOf(level),
    blocked = !!dialog || !!files.pending || files.busy;
  const fit = (selection = false) =>
    setFocus((f) => ({ serial: f.serial + 1, selection }));
  function commit(document: Atlas, activeLevel?: string) {
    dispatch({ type: "commit", document, activeLevel });
    setError("");
  }
  function attempt(action: () => Atlas, close = false) {
    try {
      commit(action());
      if (close) setDialog(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function add() {
    try {
      const a = addLevel(s.document, level.id);
      commit(a, a.levels[index + 1].id);
    } catch (e) {
      setError(String(e));
    }
  }
  function remove() {
    if (level.rooms.length) setDialog({ kind: "delete" });
    else attempt(() => deleteLevel(s.document, level.id));
  }
  useEffect(() => {
    if (blocked) dispatch({ type: "cancel" });
  }, [blocked]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (blocked || isTextInput(e.target) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (!["s", "o", "n", "z", "y"].includes(k)) return;
        e.preventDefault();
        if (k === "s") void files.save(e.shiftKey);
        if (k === "o") files.request("open");
        if (k === "n") files.request("new");
        if (k === "z") dispatch({ type: e.shiftKey ? "redo" : "undo" });
        if (k === "y") dispatch({ type: "redo" });
        return;
      }
      const t = tools.find((t) => t.key === k);
      if (t) {
        e.preventDefault();
        dispatch({ type: "tool", tool: t.id });
      }
      if (k === "escape") {
        dispatch({ type: "cancel" });
        setError("");
      }
      if (k === "f" || e.key === "Home") {
        e.preventDefault();
        fit(k === "f");
      }
      if (e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
        const next = s.document.levels[index + (e.key === "PageUp" ? 1 : -1)];
        if (next) dispatch({ type: "level", id: next.id });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [s, blocked, files]);
  return (
    <div className="app">
      <div className="editor-shell" inert={blocked}>
        <header className="document-bar">
          <div className="brand">
            <Map size={25} />
            <span>
              SaltMarcher <small>Atlas</small>
            </span>
          </div>
          <h1>
            {files.name.replace(/\.saltatlas\.json$/, "")}
            <span
              className={`dirty ${files.dirty ? "unsaved" : ""}`}
              title={files.dirty ? "Ungespeicherte Änderungen" : "Gespeichert"}
              aria-label={
                files.dirty ? "Ungespeicherte Änderungen" : "Gespeichert"
              }
            />
          </h1>
          <nav aria-label="Datei">
            <button onClick={() => files.request("new")}>
              <Plus size={16} />
              Neu
            </button>
            <button onClick={() => files.request("open")}>
              <FolderOpen size={16} />
              Öffnen
            </button>
            <button className="primary" onClick={() => void files.save()}>
              <Save size={16} />
              Speichern
            </button>
            <button onClick={() => void files.save(true)}>
              Speichern unter …
            </button>
          </nav>
        </header>
        <main>
          <aside className="toolrail" aria-label="Werkzeuge">
            {tools.map((t) => (
              <button
                key={t.id}
                aria-label={t.name}
                title={`${t.name} (${t.key.toUpperCase()})`}
                aria-pressed={s.tool === t.id}
                className={s.tool === t.id ? "active" : ""}
                onClick={() => dispatch({ type: "tool", tool: t.id as Tool })}
              >
                <t.icon size={22} />
                <small>{t.key.toUpperCase()}</small>
              </button>
            ))}
            <hr />
            <button
              aria-label="Rückgängig"
              title="Rückgängig (Strg+Z)"
              disabled={!s.past.length}
              onClick={() => dispatch({ type: "undo" })}
            >
              <Undo2 size={21} />
            </button>
            <button
              aria-label="Wiederholen"
              title="Wiederholen (Strg+Umschalt+Z)"
              disabled={!s.future.length}
              onClick={() => dispatch({ type: "redo" })}
            >
              <Redo2 size={21} />
            </button>
          </aside>
          <section className="map-area" aria-label="Karte">
            <MapCanvas
              document={s.document}
              level={level}
              below={s.ghost ? s.document.levels[index - 1] : undefined}
              tool={s.tool}
              selection={s.selection}
              view={s.view}
              gestureVersion={s.gestureVersion}
              focus={focus}
              onView={(view) => dispatch({ type: "view", view })}
              onCommit={commit}
              onSelect={(cells) => dispatch({ type: "select", cells })}
              onError={setError}
            />
            <div className="map-heading">{level.name}</div>
            <div className="map-controls">
              <label>
                <input
                  type="checkbox"
                  checked={s.ghost}
                  disabled={index === 0}
                  onChange={(e) =>
                    dispatch({ type: "ghost", enabled: e.target.checked })
                  }
                />
                Unteres Geschoss
              </label>
              <span className="zoom-value">
                {Math.round(s.view.zoom * 100)}%
              </span>
              <button
                aria-label="Auswahl einpassen"
                title="Auswahl einpassen (F)"
                disabled={!s.selection.length}
                onClick={() => fit(true)}
              >
                <Focus size={18} />
              </button>
              <button
                aria-label="Karte einpassen"
                title="Karte einpassen (Pos1)"
                onClick={() => fit()}
              >
                <Scan size={18} />
              </button>
            </div>
          </section>
          <aside className="inspector">
            <LevelPanel
              levels={s.document.levels}
              active={level.id}
              onSelect={(id) => dispatch({ type: "level", id })}
              onAdd={add}
              onMove={(d) => attempt(() => moveLevel(s.document, level.id, d))}
              onRename={() => setDialog({ kind: "rename", name: level.name })}
              onDelete={remove}
            />
            <RoomPanel
              level={level}
              selection={s.selection}
              onSelect={(cells) => {
                dispatch({ type: "tool", tool: "select" });
                dispatch({ type: "select", cells });
              }}
              onAssign={() => setDialog({ kind: "assign" })}
              onRename={(id, name) =>
                attempt(() => renameRoom(s.document, level.id, id, name))
              }
            />
          </aside>
        </main>
        <footer>
          <span>
            {tools.find((t) => t.id === s.tool)!.name} · Leertaste zum
            Verschieben
          </span>
          <span>
            {Object.keys(level.cells).length} Zellen ·{" "}
            {s.document.levels.length} Geschosse · 5 ft / Zelle
          </span>
        </footer>
      </div>
      {files.busy && (
        <div className="busy" role="status">
          Datei wird verarbeitet …
        </div>
      )}
      {error && (
        <div className="toast" role="alert">
          {error}
          <button aria-label="Meldung schließen" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {files.pending && (
        <Modal
          title="Ungespeicherte Änderungen"
          onClose={() => {
            if (!files.busy) void files.resolve("cancel");
          }}
        >
          <p>Deine Änderungen wurden noch nicht gespeichert.</p>
          <div className="modal-actions">
            <button
              disabled={files.busy}
              onClick={() => void files.resolve("cancel")}
            >
              Abbrechen
            </button>
            <button
              disabled={files.busy}
              onClick={() => void files.resolve("discard")}
            >
              Verwerfen
            </button>
            <button
              disabled={files.busy}
              className="primary"
              onClick={() => void files.resolve("save")}
            >
              Speichern und fortfahren
            </button>
          </div>
        </Modal>
      )}
      {dialog && (
        <Modal
          title={
            dialog.kind === "rename"
              ? "Geschoss umbenennen"
              : dialog.kind === "delete"
                ? "Geschoss löschen"
                : "Raum zuweisen"
          }
          onClose={() => setDialog(null)}
        >
          {dialog.kind === "rename" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                attempt(
                  () => renameLevel(s.document, level.id, dialog.name),
                  true,
                );
              }}
            >
              <label>
                Geschossname
                <input
                  maxLength={120}
                  required
                  value={dialog.name}
                  onChange={(e) =>
                    setDialog({ kind: "rename", name: e.target.value })
                  }
                />
              </label>
              <div className="modal-actions">
                <button className="primary" disabled={!dialog.name.trim()}>
                  Name übernehmen
                </button>
              </div>
            </form>
          )}
          {dialog.kind === "delete" && (
            <>
              <p>
                „{level.name}“ mit {level.rooms.length} Räumen und{" "}
                {Object.keys(level.cells).length} Zellen löschen? Die Aktion
                lässt sich rückgängig machen.
              </p>
              <div className="modal-actions">
                <button onClick={() => setDialog(null)}>Abbrechen</button>
                <button
                  className="danger"
                  onClick={() =>
                    attempt(() => deleteLevel(s.document, level.id), true)
                  }
                >
                  Geschoss endgültig löschen
                </button>
              </div>
            </>
          )}
          {dialog.kind === "assign" && (
            <AssignForm
              level={level}
              onSubmit={(target, name) =>
                attempt(
                  () => assign(s.document, level.id, s.selection, target, name),
                  true,
                )
              }
            />
          )}
        </Modal>
      )}
    </div>
  );
}
