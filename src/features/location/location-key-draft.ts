import {
  checkedLocationDocument,
  serializeLocationDocument,
  type LocationDocument,
  type LocationSection,
} from "./location-schema";

/** Local text stays intact until the exact owner baseline accepts one command. */
export class LocationKeyDraft {
  private baseline: LocationDocument;
  name: string;
  type: "city" | "poi";
  private rows: LocationSection[];
  constructor(document: LocationDocument) {
    this.baseline = checkedLocationDocument(document);
    this.name = this.baseline.name;
    this.type = this.baseline.type;
    this.rows = this.baseline.sections.map((s) => ({ ...s }));
  }
  get id(): string {
    return this.baseline.id;
  }
  get sections(): readonly LocationSection[] {
    return this.rows;
  }
  get dirty(): boolean {
    return (
      this.name !== this.baseline.name ||
      this.type !== this.baseline.type ||
      JSON.stringify(this.rows) !== JSON.stringify(this.baseline.sections)
    );
  }
  matches(document: LocationDocument): boolean {
    return (
      serializeLocationDocument(document) ===
      serializeLocationDocument(this.baseline)
    );
  }
  section(id: string, field: "title" | "markdown", value: string): void {
    const index = this.rows.findIndex((s) => s.id === id);
    if (index < 0) throw new Error("Ortsabschnitt fehlt.");
    this.rows[index] = { ...this.rows[index]!, [field]: value };
  }
  move(id: string, direction: -1 | 1): void {
    const index = this.rows.findIndex((s) => s.id === id),
      next = index + direction;
    if (index < 0) throw new Error("Ortsabschnitt fehlt.");
    if (next < 0 || next >= this.rows.length) return;
    [this.rows[index], this.rows[next]] = [this.rows[next]!, this.rows[index]!];
  }
  apply(
    current: LocationDocument | null,
    write: (document: LocationDocument) => boolean,
  ): boolean {
    if (!this.dirty) return false;
    if (!current || !this.matches(current))
      throw new Error(
        "Der Ort wurde inzwischen geändert. Der eingegebene Text bleibt erhalten.",
      );
    const next = checkedLocationDocument({
      ...this.baseline,
      name: this.name,
      type: this.type,
      sections: this.rows,
    });
    if (!write(next))
      throw new Error(
        "Orts-Key wurde nicht übernommen. Der Text bleibt erhalten.",
      );
    this.baseline = next;
    return true;
  }
}
