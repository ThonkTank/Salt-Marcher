import { PreviewSummary } from "./PopulationPanel";
import type { editorView } from "./editorView";
export function EditorActions({
  visible,
  controls,
  showGeneration,
  preview,
  message,
  pending,
  committing,
  recheck,
  canAccept,
  onAccept,
  onCancel,
  onRecheck,
}: ReturnType<typeof editorView>["actions"] & {
  canAccept: boolean;
  onAccept: () => void;
  onCancel: () => void;
  onRecheck: () => void;
}) {
  if (!visible) return null;
  return (
    <section className="atlas-actions" aria-label="Planung abschließen">
      {showGeneration && preview?.generationSummary && (
        <PreviewSummary preview={preview} />
      )}
      <div role="status" aria-label="Aktionsstatus">
        {message ||
          (committing
            ? "Änderung wird übernommen …"
            : pending
              ? "Vorschau wird aktualisiert …"
              : "")}
      </div>
      {recheck && <button onClick={onRecheck}>Vorschau erneut prüfen</button>}
      {controls && (
        <div className="atlas-action-buttons">
          <button
            className="atlas-primary"
            disabled={!canAccept}
            onClick={onAccept}
          >
            Übernehmen
          </button>
          <button disabled={committing} onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      )}
    </section>
  );
}
