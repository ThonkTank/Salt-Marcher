/*
 * Salt Marcher – TileNoteService
 * Ziel: Zentraler Service zum Finden/Erstellen/Öffnen von Tile-Notizen anhand (q,r[,region]).
 *
 * Muss-Funktionen
 *  - getPathFor(q,r,region)
 *  - find(q,r)
 *  - createIfMissing(q,r,region,defaults)
 *  - open(q,r)
 *  - Rückgabewerte mit { path, id }
 *
 * Hinweise
 *  - Fallback-Region aus Settings, sonst "Default".
 *  - Ordnerstruktur: <hexesRoot>/<Region>/<q>_<r>.md  (Hexes/<Region>/1_-2.md)
 *  - "Leichter Index-Scan": Falls der deterministische Pfad nicht existiert, scanne Hexes/<Region>/ nach YAML coords.
 *  - Viele Debug-Logs! (nutzt internen Logger, bricht nicht wenn kein globaler Logger existiert)
 *  - Bidi-Links (P0 light): fügt am Ende eine Backlink-Sektion als Platzhalter ein.
 */

import { App, TAbstractFile, TFile, normalizePath } from "obsidian";

// === Types ===
export type TileNoteRef = { path: string; id: string; file?: TFile };
export type TileDefaults = Partial<{
  terrain: { tier: number | null; speed_mod: number };
  features: string[];
  visibility: { elevation: number | null; blocks_view: boolean };
}>;

export type SaltMarcherLikeSettings = Partial<{
  defaultRegion: string;
  folders: { hexesRoot: string };
  templates: { tile: string | null };
}>;

export class TileNoteService {
  private app: App;
  private settings: SaltMarcherLikeSettings;

  constructor(app: App, settings: SaltMarcherLikeSettings) {
    this.app = app;
    this.settings = settings ?? {};
  }

  // =========== Logger (robust, keine externen Abhängigkeiten nötig) ==========
  private log(level: "DEBUG" | "INFO" | "WARN" | "ERROR", scope: string, msg: string, data?: unknown) {
    const prefix = `[${level}][${scope}]`;
    try {
      if (data !== undefined) {
        // Stringify defensiv, damit wir nie Exceptions werfen
        const safe = (() => {
          try {
            return JSON.stringify(data);
          } catch (_) {
            return String(data);
          }
        })();
        // eslint-disable-next-line no-console
        console.log(prefix, msg, safe);
      } else {
        // eslint-disable-next-line no-console
        console.log(prefix, msg);
      }
    } catch (_) {
      // ignorieren – Logging darf niemals die App crashen
    }
  }

  // ======================== Öffentliche API ========================

  /** Deterministischer Pfad für (q,r,region). */
  getPathFor(q: number, r: number, region?: string): string {
    const hexesRoot = this.settings.folders?.hexesRoot || "Hexes";
    const reg = region || this.settings.defaultRegion || "Default";
    const path = normalizePath(`${hexesRoot}/${reg}/${q}_${r}.md`);
    this.log("DEBUG", "Notes", `resolve { q:${q}, r:${r}, region:${reg} } -> "${path}"`);
    return path;
  }

  /**
   * Findet eine bestehende Datei zu (q,r).
   * 1) Prüft den deterministischen Pfad.
   * 2) Wenn nicht vorhanden, scannt den Regionsordner nach YAML coords.
   */
  async find(q: number, r: number, region?: string): Promise<TileNoteRef | null> {
    const reg = region || this.settings.defaultRegion || "Default";
    const path = this.getPathFor(q, r, reg);

    // 1) Direkt am Pfad
    const dirHit = this.app.vault.getAbstractFileByPath(path);
    if (dirHit instanceof TFile) {
      const id = await this.ensureIdAndCoords(dirHit, { q, r, region: reg });
      this.log("INFO", "Notes", `foundByPath { q:${q}, r:${r}, id:"${id}" }`, { path });
      return { path, id, file: dirHit };
    }

    // 2) Leichter Index-Scan über Hexes/<Region>/
    const folderPath = normalizePath(`${this.settings.folders?.hexesRoot || "Hexes"}/${reg}`);
    const folder = this.app.vault.getAbstractFileByPath(folderPath);

    if (!folder) {
      this.log("WARN", "Notes", "regionFolderMissing – no scan possible", { folderPath });
      return null;
    }

    const matches: TFile[] = [];
    this.walk(folder, (f) => {
      if (f instanceof TFile && f.extension.toLowerCase() === "md") {
        const cache = this.app.metadataCache.getFileCache(f);
        const fm: any = cache?.frontmatter;
        if (fm?.coords && typeof fm.coords.q === "number" && typeof fm.coords.r === "number") {
          if (fm.coords.q === q && fm.coords.r === r) matches.push(f);
        }
      }
    });

    if (matches.length > 0) {
      // Bei mehreren Treffern: deterministisch die erste nach Pfadname
      matches.sort((a, b) => a.path.localeCompare(b.path));
      const file = matches[0];
      const id = await this.ensureIdAndCoords(file, { q, r, region: reg });
      this.log("INFO", "Notes", `foundByScan { q:${q}, r:${r}, id:"${id}" }`, { path: file.path });
      return { path: file.path, id, file };
    }

    this.log("DEBUG", "Notes", `find.miss { q:${q}, r:${r}, region:${reg} }`);
    return null;
  }

  /**
   * Erstellt die Notiz, falls nicht vorhanden. Liefert Referenz zurück.
   */
  async createIfMissing(
    q: number,
    r: number,
    region?: string,
    defaults?: TileDefaults
  ): Promise<TileNoteRef> {
    const reg = region || this.settings.defaultRegion || "Default";

    // 1) Existiert bereits?
    const existing = await this.find(q, r, reg);
    if (existing) {
      this.log("DEBUG", "Notes", "createIfMissing.hit – already exists", existing);
      return existing;
    }

    // 2) Ordner sicherstellen
    const path = this.getPathFor(q, r, reg);
    const { parent } = this.splitPath(path);
    await this.ensureFolder(parent);

    // 3) Datei erzeugen
    const id = this.makeId();
    const content = this.renderTileTemplate({ q, r, region: reg, id, defaults });

    let file: TFile;
    try {
      file = await this.app.vault.create(path, content);
      this.log("INFO", "Notes", `created { q:${q}, r:${r}, id:"${id}" }`, { path });
    } catch (err) {
      this.log("ERROR", "Notes", "createFailed", { path, error: String(err) });
      throw err;
    }

    // 4) Frontmatter sicherstellen (falls Templates angepasst wurden)
    await this.ensureIdAndCoords(file, { q, r, region: reg, id });

    return { path, id, file };
  }

  /** Öffnet (oder erstellt und öffnet) die Notiz für (q,r). */
  async open(q: number, r: number, region?: string): Promise<TileNoteRef> {
    const reg = region || this.settings.defaultRegion || "Default";
    const ref = (await this.find(q, r, reg)) ?? (await this.createIfMissing(q, r, reg));

    try {
      const leaf = this.app.workspace.getLeaf(true);
      await leaf.openFile(ref.file ?? (this.app.vault.getAbstractFileByPath(ref.path) as TFile));
      this.log("INFO", "Notes", "opened", { path: ref.path, id: ref.id });
    } catch (err) {
      this.log("ERROR", "Notes", "openFailed", { path: ref.path, reason: String(err) });
      throw err;
    }

    return ref;
  }

  // ======================== Private Helpers ========================

  /** Sichere ID & Coords im Frontmatter; generiert ID wenn nötig. */
  private async ensureIdAndCoords(
    file: TFile,
    opts: { q: number; r: number; region: string; id?: string }
  ): Promise<string> {
    const cache = this.app.metadataCache.getFileCache(file);
    let id: string | undefined = (cache?.frontmatter as any)?.id;

    // Wenn keine ID im Cache, versuchen wir sie im Dokument zu setzen
    if (!id) id = opts.id || this.makeId();

    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        (fm as any).id = (fm as any).id || id;
        (fm as any).type = (fm as any).type || "tile";
        (fm as any).coords = {
          q: opts.q,
          r: opts.r,
          region: opts.region,
        };
      });
    } catch (err) {
      this.log("WARN", "Notes", "processFrontMatter.failed – falling back to raw write", {
        path: file.path,
        error: String(err),
      });
      // Fallback: Rohtext parsen und ersetzen
      const raw = await this.app.vault.read(file);
      const updated = this.patchFrontmatterRaw(raw, {
        id,
        type: "tile",
        coords: { q: opts.q, r: opts.r, region: opts.region },
      });
      await this.app.vault.modify(file, updated);
    }

    return id;
  }

  /** Erzeugt eine robuste, menschenlesbare ID. */
  private makeId(): string {
    const base = Math.random().toString(36).slice(2, 8);
    const stamp = Date.now().toString(36).slice(-4);
    return `hex_${base}${stamp}`;
  }

  private splitPath(path: string): { parent: string; basename: string } {
    const idx = path.lastIndexOf("/");
    if (idx === -1) return { parent: "", basename: path };
    return { parent: path.slice(0, idx), basename: path.slice(idx + 1) };
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    if (!folderPath || folderPath === "/") return;
    const segs = folderPath.split("/");
    let acc = "";
    for (const seg of segs) {
      acc = acc ? `${acc}/${seg}` : seg;
      const existing = this.app.vault.getAbstractFileByPath(acc);
      if (!existing) {
        try {
          await this.app.vault.createFolder(acc);
          this.log("DEBUG", "Notes", "createFolder", { path: acc });
        } catch (err) {
          // Ordner könnte in der Zwischenzeit erstellt worden sein – nur warnen
          this.log("WARN", "Notes", "ensureFolder.failed", { path: acc, error: String(err) });
        }
      }
    }
  }

  /** DFS über ein Vault-Tree-Substrukt. */
  private walk(root: TAbstractFile, visit: (f: TAbstractFile) => void) {
    visit(root);
    // @ts-ignore – Obsidian hat children auf TFolder, aber wir prüfen zur Laufzeit
    if (root.children && Array.isArray(root.children)) {
      // @ts-ignore
      for (const child of root.children) this.walk(child, visit);
    }
  }

  /** Sehr einfache Template-Generierung (nutzt Einstellungen wenn vorhanden). */
  private renderTileTemplate(args: {
    q: number;
    r: number;
    region: string;
    id: string;
    defaults?: TileDefaults;
  }): string {
    const { q, r, region, id, defaults } = args;

    // Versuch: externes Template (Pfad oder Name) laden – falls bereitgestellt
    const tplNameOrPath = this.settings.templates?.tile;
    if (tplNameOrPath) {
      // Soft attempt: Wenn eine Templatedatei existiert, lese sie und fülle Minimalfelder
      const file = this.app.vault.getAbstractFileByPath(tplNameOrPath);
      if (file instanceof TFile) {
        // Wir ersetzen nur ein paar bekannte Platzhalter, ohne den Benutzer zu stören
        // (z.B. {{id}}, {{q}}, {{r}}, {{region}})
        // Wenn nix passt, schreiben wir unten unseren Fallback.
        try {
          const raw = await this.app.vault.read(file);
          const rendered = raw
            .replaceAll("{{id}}", id)
            .replaceAll("{{q}}", String(q))
            .replaceAll("{{r}}", String(r))
            .replaceAll("{{region}}", region);
          const ensured = this.patchFrontmatterRaw(rendered, {
            id,
            type: "tile",
            coords: { q, r, region },
          });
          return ensured + this.backlinkSection();
        } catch (e) {
          this.log("WARN", "Notes", "templateReadFailed – falling back", { tplNameOrPath, error: String(e) });
        }
      }
    }

    // Fallback-Minimaltemplate
    const terrain = defaults?.terrain ?? { tier: null, speed_mod: 1 };
    const visibility = defaults?.visibility ?? { elevation: null, blocks_view: false };
    const features = defaults?.features ?? [];

    const yaml = [
      "---",
      `id: ${id}`,
      "type: tile",
      "coords:",
      `  q: ${q}`,
      `  r: ${r}`,
      `  region: ${region}`,
      "terrain:",
      `  tier: ${terrain.tier ?? null}`,
      `  speed_mod: ${terrain.speed_mod ?? 1}`,
      "features:",
      ...(features.length ? features.map((f) => `  - ${f}`) : ["  []"]),
      "visibility:",
      `  elevation: ${visibility.elevation ?? null}`,
      `  blocks_view: ${visibility.blocks_view ?? false}`,
      "---",
      "",
      `# Hex (${q}, ${r}) – ${region}`,
      "",
      "## Summary",
      "Kurzbeschreibung des Hexes…",
      "",
      "## Points of Interest",
      "- ",
      "",
      "## Travel Notes",
      "- base_speed_mod: {{calc_here}}",
      "",
    ].join("\n");

    return yaml + this.backlinkSection();
  }

  private backlinkSection(): string {
    return "\n## Backlinks\n<!-- reserved for Salt Marcher bidi links (P0 light) -->\n";
  }

  /**
   * Minimaler YAML-Patcher: ersetzt/fügt id/type/coords hinzu.
   * ⚠️ Beabsichtigt simpel zu sein – keine vollständige YAML-Implementierung.
   */
  private patchFrontmatterRaw(raw: string, inject: { id: string; type: string; coords: { q: number; r: number; region: string } }): string {
    const fmRegex = /^---[\s\S]*?---/m;
    const block = [
      "---",
      `id: ${inject.id}`,
      `type: ${inject.type}`,
      "coords:",
      `  q: ${inject.coords.q}`,
      `  r: ${inject.coords.r}`,
      `  region: ${inject.coords.region}`,
      "---",
    ].join("\n");

    if (fmRegex.test(raw)) {
      // Ersetze existierenden Block grob – in echt wäre ein YAML-Merger schöner
      return raw.replace(fmRegex, block);
    } else {
      return block + "\n" + raw;
    }
  }
}
