/*
 * ChronicleService.ts – Session-Log, das Events automatisch protokolliert (Feature 7)
 * Abhängigkeiten: EventBus (Feature 6), Clock, Settings (sessionsFolder, currentSessionPath)
 * Ausgiebige Debug-Logs (Namespace "Chronicle")
 */
import type { App, TFile, TFolder } from "obsidian";
import { normalizePath, Notice } from "obsidian";
import type { Plugin } from "obsidian";
import { createLogger } from "./logger";
import type { SaltSettings } from "./settings";
import { EventBus, type EventMap } from "./EventBus";
import { Clock } from "./Clock";

export class ChronicleService {
  private log = createLogger("Chronicle");

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: SaltSettings,
    private bus: EventBus<EventMap>,
    private clock: Clock
  ) {}

  /** Muss nach Konstruktion aufgerufen werden, um Event-Listener zu registrieren. */
  initListeners(): void {
    // Reise angewandt → protokollieren
    this.bus.on("route:applied", ({ totalMin, nextISO, traceId }) => {
      try {
        this.log.debug("event.route:applied", { totalMin, nextISO, traceId });
        const iso = nextISO ?? this.clock.now();
        const entry = this.renderTravelEntry(totalMin, iso);
        this.appendToCurrentSession(entry).catch((err) => this.log.error("append.failed", { err }));
      } catch (err) {
        this.log.error("route:applied handler failed", { err });
      }
    });

    // Allgemeiner Debug: Stundenticks nur loggen (kein Spam ins Markdown im P0)
    this.bus.on("clock:hourlyTick", ({ tickISO }) => {
      this.log.debug("event.clock:hourlyTick", { tickISO });
    });

    this.log.info("Listeners aktiviert");
  }

  /** UI/Command: Setzt die aktuelle Session auf die gerade aktive Datei. */
  async setCurrentFromActiveFile(): Promise<void> {
    try {
      // @ts-expect-error app.workspace.getActiveFile existiert in Obsidian
      const active: TFile | null = this.app.workspace.getActiveFile?.();
      if (!active) {
        new Notice("Keine aktive Datei gefunden.");
        this.log.warn("setCurrentFromActiveFile: no active file");
        return;
      }
      this.settings.currentSessionPath = active.path;
      await (this.plugin as any).saveSettings();
      new Notice("Chronicle: Aktuelle Session gesetzt.");
      this.log.info("currentSessionPath set", { path: active.path });
    } catch (err) {
      this.log.error("setCurrentFromActiveFile.failed", { err });
    }
  }

  /** UI/Command: Erzeugt eine Session-Notiz für 'heute' und setzt sie als aktuelle. */
  async createTodaySession(): Promise<TFile> {
    const folder = this.settings.sessionsFolder || "Sessions";
    const date = new Date();
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const fname = `${yyyy}-${mm}-${dd}.md`;

    const path = normalizePath(`${folder}/${fname}`);
    await this.ensureFolder(folder);

    let file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      const title = `${yyyy}-${mm}-${dd}`;
      const fm = [
        "---",
        `session: ${title}`,
        `date: ${date.toISOString()}`,
        "visited: []",
        "---",
        `# Session ${title}`,
        "",
        "## Log",
        ""
      ].join("\n");
      try {
        file = await this.app.vault.create(path, fm);
        this.log.info("createTodaySession: created", { path });
      } catch (err) {
        this.log.error("createTodaySession: create failed", { path, err });
        throw err;
      }
    }

    this.settings.currentSessionPath = path;
    await (this.plugin as any).saveSettings();
    new Notice(`Chronicle: Session gesetzt → ${path}`);
    return file as TFile;
  }

  /** Hängt Markdown an die aktuelle Session-Datei an. Legt sie optional an. */
  async appendToCurrentSession(markdown: string): Promise<void> {
    const file = await this.getOrCreateCurrentSessionFile();
    const existing = await this.app.vault.read(file);
    const next = existing.trimEnd() + "\n" + markdown + "\n";
    await this.app.vault.modify(file, next);
    this.log.info("append.ok", { bytes: markdown.length, path: file.path });
  }

  /** Liefert aktuelle Session-Datei oder legt eine für 'heute' an, wenn keine gesetzt. */
  async getOrCreateCurrentSessionFile(): Promise<TFile> {
    let path = this.settings.currentSessionPath;
    const folder = this.settings.sessionsFolder || "Sessions";
    if (!path) {
      this.log.warn("no currentSessionPath – creating today");
      await this.createTodaySession();
      path = this.settings.currentSessionPath!;
    }
    const abs = this.app.vault.getAbstractFileByPath(path!);
    if (abs && abs instanceof (window as any).TFile) return abs as TFile;
    // Falls Pfad nicht existiert → erstellen
    await this.ensureFolder(folder);
    try {
      const init = ["---", `session: ${new Date().toISOString()}`, "---", "# Session", "", "## Log", ""].join("\n");
      const f = await this.app.vault.create(path!, init);
      this.log.info("getOrCreateCurrentSessionFile: created missing", { path });
      return f;
    } catch (err) {
      this.log.error("getOrCreateCurrentSessionFile: create failed", { path, err });
      throw err;
    }
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    const parts = normalizePath(folderPath).split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const abs = this.app.vault.getAbstractFileByPath(current);
      if (!abs) {
        try {
          await this.app.vault.createFolder(current);
          this.log.debug("createFolder", { current });
        } catch (err) {
          // race condition ok
          this.log.warn("createFolder.failed", { current, err });
        }
      } else if (!(abs instanceof (window as any).TFolder)) {
        throw new Error(`Pfad-Kollision: ${current} ist keine Mappe`);
      }
    }
  }

  private renderTravelEntry(totalMin: number, nextISO: string): string {
    const dt = new Date(nextISO);
    const ts = dt.toISOString().replace("T", " ").replace("Z", " UTC");
    return [
      `### ${ts} – Reise abgeschlossen`,
      ``,
      `- **Dauer:** +${totalMin} Min`,
      `- **Zeit jetzt:** ${dt.toISOString()}`,
      ``
    ].join("\n");
  }
}
