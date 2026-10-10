import { CitySource, cityDocumentChange } from "./commands";
import { editCity, type CityEdit } from "./edit";
import type { CityDocument } from "./model";
import { cityScene, type CityScene } from "./scene";

export interface CityDraftPreview {
  readonly document: CityDocument;
  readonly scene: CityScene;
}
export type CityDraftState =
  | "editing"
  | "invalid"
  | "failed"
  | "applied"
  | "cancelled";

/** A transient gesture against one fixed baseline; only Apply touches shared history. */
export class CityDraft {
  readonly before: CityDocument;
  private currentState: CityDraftState = "editing";
  private candidate: CityDraftPreview | null = null;
  private readonly baselineIdentity;
  constructor(private readonly source: CitySource) {
    this.before = source.read();
    this.baselineIdentity = source.snapshotIdentity;
  }
  get state(): CityDraftState {
    return this.currentState;
  }
  get preview(): CityDraftPreview | null {
    return this.candidate;
  }
  private assertEditable(): void {
    if (this.currentState !== "editing" && this.currentState !== "invalid")
      throw new Error("Stadtentwurf bereits abgeschlossen.");
    if (this.source.snapshotIdentity !== this.baselineIdentity) {
      this.currentState = "failed";
      this.candidate = null;
      throw new Error("Stadtentwurf kollidiert mit einem geänderten Stadtstand.");
    }
  }
  setEdits(edits: readonly CityEdit[]): CityDraftPreview {
    this.assertEditable();
    try {
      const document = editCity(this.before, edits);
      const preview = Object.freeze({ document, scene: cityScene(document) });
      this.candidate = preview;
      this.currentState = "editing";
      return preview;
    } catch (error) {
      this.candidate = null;
      this.currentState = "invalid";
      throw error;
    }
  }
  clearPreview(): void {
    this.assertEditable();
    this.candidate = null;
    this.currentState = "editing";
  }
  apply(label: string): boolean {
    this.assertEditable();
    if (this.currentState !== "editing" || !this.candidate)
      throw new Error("Stadtentwurf hat keine vollständige gültige Vorschau.");
    if (typeof label !== "string" || !label.trim() || label.length > 200)
      throw new Error("Ungültige Stadt-Befehlsbezeichnung.");
    try {
      const changed = this.source.history.execute({
        label,
        changes: [cityDocumentChange(this.before, this.candidate.document)],
      });
      this.currentState = "applied";
      this.candidate = null;
      return changed;
    } catch (error) {
      this.currentState = "failed";
      this.candidate = null;
      throw error;
    }
  }
  cancel(): boolean {
    if (this.currentState === "applied" || this.currentState === "cancelled")
      return false;
    this.candidate = null;
    this.currentState = "cancelled";
    return true;
  }
}
