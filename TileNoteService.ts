/* 
 * Salt Marcher – TileNoteService (Fortsetzung Feature 3)
 * Ziel: Zentraler Service zum Finden/Erstellen/Öffnen von Tile-Notizen anhand (q,r[,region]).
 * 
 * Muss-Funktionen
 * - getPathFor(q,r,region)
 * - find(q,r,region)
 * - createIfMissing(q,r,region,defaults)
 * - open(q,r,region)
 * 
 * Design
 * - Deterministische Pfade: "<hexFolder>/<region>/<q>_<r>.md"
 * - "Leichter Index-Scan": Wenn Datei nicht am Pfad liegt, scannt Regionsordner nach YAML coords.
 * - Sehr viele Debug-Logs (Namespace: "Notes/Tile").
 */

import { App, TAbstractFile, TFile, normalizePath } from "obsidian";
import { createLogger } from "./logger";
import type { SaltSettings } from "./settings";

// ——— Types ————————————————————————————————————————————————————————————————
export type TileNoteRef = { path: string; id: string; file?: TFile };

export type TileDefaults = Partial<{
  terrain: { tier: number | null; speed_mod: number };
  features: string[];
  visibility: { elevation: number | null; blocks_view: boolean };
}>;

// Optional: Template-Pfad, ohne Settings zwingend zu ändern (bleibt kompatibel)
type MaybeTemplateSetting = Partial<{
  templates: { tile?: string | null };
}>;

export class TileNoteService {
  private app: App;
  private settings: SaltSettings & MaybeTemplateSetting;
  private log = createLogger("Notes/Tile");

  constructor(app: App, settings: SaltSettings & MaybeTemplateSetting) {
    this.app = app;
    this.settings = settings ?? ({} as any);
    this.log.debug("TileNoteService.ctor", {
      hasTemplatesKey: !!(settings as any)?.templates,
      hexFolder: this.settings.hexFolder,
      defaultRegion: this.settings.defaultRegion,
    });
  }

  // ======================== Öffentliche API ================================

  /** Deterministischer Pfad für (q,r,region). */
  getPathFor(q: number, r: number, region?: string): string {
    const hexesRoot = this.settings.hexFolder || "Hexes";
    const reg = (region || this.settings.defaultRegion || "Default").replace(/\//g, "-");
    const path = normalizePath(`${hexesRoot}/${reg}/${q}_${r}.md`);
    this.log.debug("getPathFor", { q, r, region: reg, path });
    return path;
  }

  /**
   * Findet eine bestehende Datei zu (q,r,region).
   * 1) Prüft den deterministischen Pfad.
   * 2) Wenn nicht vorhanden, scannt den Regionsordner nach YAML coords.
   */
  async find(q: number, r: number, region?: string): Promise<TileNoteRef | null> {
    const reg = (region || this.settings.defaultRegion || "Default").trim();
    const path = this.getPathFor(q, r, reg);

    // 1) Direkt am Pfad
    const direct = this.app.vault.getAbstractFileByPath(path);
    if (direct instanceof TFile) {
      const id = await this.ensureIdAndCoords(direct, { q, r, region: reg });
      this.log.info("find.foundByPath", { q, r, id, path });
      return { path, id, file: direct };
    }

    // 2) Regions-Ordner scannen
    const folderPath = normalizePath(`${this.settings.hexFolder || "Hexes"}/${reg}`);
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      this.log.warn("find.regionFolderMissing", { folderPath, q, r });
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
      this.log.info("find.foundByScan", { q, r, id, path: file.path, candidates: matches.length });
      return { path: file.path, id, file };
    }

    this.log.debug("find.miss", { q, r, region: reg });
    return null;
  }

  /** Erstellt die Notiz, falls nicht vorhanden. */
  async createIfMissing(
    q: number,
    r: number,
    region?: string,
    defaults?: TileDefaults
  ): Promise<TileNoteRef> {
    const reg = (region || this.settings.defaultRegion || "Default").trim();

    // 1) Existiert bereits?
    const existing = await this.find(q, r, reg);
    if (existing) {
      this.log.debug("createIfMissing.hit", { q, r, region: reg, path: existing.path });
      return existing;
    }

    // 2) Ordner sicherstellen
    const path = this.getPathFor(q, r, reg);
    const { parent } = this.splitPath(path);
    await this.ensureFolder(parent);

    // 3) Inhalt erzeugen & Datei schreiben
    const id = this.makeId();
    const content = await this.renderTileTemplate({ q, r, region: reg, id, defaults });

    let file: TFile;
    try {
      file = await this.app.vault.create(path, content);
      this.log.info("createIfMissing.created", { q, r, region: reg, id, path });
    } catch (err) {
      this.log.error("createIfMissing.createFailed", { path, error: String(err) });
      throw err;
    }

    // 4) Frontmatter sicherstellen (falls Template unvollständig war)
    await this.ensureIdAndCoords(file, { q, r, region: reg, id });

    return { path, id, file };
  }

  /** Öffnet (oder erstellt + öffnet) die Notiz. */
  async open(q: number, r: number, region?: string): Promise<TileNoteRef> {
    const reg = (region || this.settings.defaultRegion || "Default").trim();
    const ref = (await this.find(q, r, reg)) ?? (await this.createIfMissing(q, r, reg));

    try {
      const leaf = this.app.workspace.getLeaf(true);
      await leaf.openFile(ref.file ?? (this.app.vault.getAbstractFileByPath(ref.path) as TFile));
      this.log.info("open.ok", { path: ref.path, id: ref.id, q, r, region: reg });
    } catch (err) {
      this.log.error("open.failed", { path: ref.path, reason: String(err) });
      throw err;
    }
    return ref;
  }

  // ======================== Private Helpers =================================

  /** Sichere ID & Coords im Frontmatter; generiert ID wenn nötig. */
  private async ensureIdAndCoords(
    file: TFile,
    opts: { q: number; r: number; region: string; id?: string }
  ): Promise<string> {
    const cache = this.app.metadataCache.getFileCache(file);
    let id: string | undefined = (cache?.frontmatter as any)?.id;
    if (!id) id = opts.id || this.makeId();

    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        (fm as any).id = (fm as any).id || id;
        (fm as any).type = (fm as any).type || "tile";
        (fm as any).coords = { q: opts.q, r: opts.r, region: opts.region };
      });
      this.log.debug("ensureIdAndCoords.processFrontMatter.ok", { path: file.path, id });
    } catch (err) {
      // Fallback: Rohtext parsen und ersetzen
      this.log.warn("ensureIdAndCoords.processFrontMatter.failed", {
        path: file.path,
        error: String(err),
      });
      const raw = await this.app.vault.read(file);
      const updated = this.patchFrontmatterRaw(raw, {
        id,
        type: "tile",
        coords: { q: opts.q, r: opts.r, region: opts.region },
      });
      await this.app.vault.modify(file, updated);
      this.log.debug("ensureIdAndCoords.rawPatch.ok", { path: file.path, id });
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
          this.log.debug("ensureFolder.created", { path: acc });
        } catch (err) {
          // Race condition möglich – nur warnen
          this.log.warn("ensureFolder.failed", { path: acc, error: String(err) });
        }
      }
    }
  }

  /** DFS über ein Vault-Tree-Substrukt. */
  private walk(root: TAbstractFile, visit: (f: TAbstractFile) => void) {
    visit(root);
    // @ts-ignore Obsidian: children nur bei TFolder – Runtime-Check reicht
    if (root.children && Array.isArray(root.children)) {
      // @ts-ignore
      for (const child of root.children) this.walk(child, visit);
    }
  }

  /** Sehr einfache Template-Generierung (nutzt optional eine externe Datei). */
  private async renderTileTemplate(args: {
    q: number;
    r: number;
    region: string;
    id: string;
    defaults?: TileDefaults;
  }): Promise<string> {
    const { q, r, region, id, defaults } = args;

    // Optionales externes Template nutzen, falls Settings so etwas vorsehen
    const tplNameOrPath = this.settings.templates?.tile;
    if (tplNameOrPath) {
      const file = this.app.vault.getAbstractFileByPath(tplNameOrPath);
      if (file instanceof TFile) {
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
          this.log.debug("renderTileTemplate.external.ok", { tpl: tplNameOrPath });
          return ensured + this.backlinkSection();
        } catch (e) {
          this.log.warn("renderTileTemplate.external.failed", {
            tpl: tplNameOrPath,
            error: String(e),
          });
        }
      } else {
        this.log.warn("renderTileTemplate.external.notFound", { tpl: tplNameOrPath });
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

    this.log.debug("renderTileTemplate.fallback", { q, r, region });
    return yaml + this.backlinkSection();
  }

  private backlinkSection(): string {
    return "\n## Backlinks\n\n";
  }

  /**
   * Minimaler YAML-Patcher: ersetzt/fügt id/type/coords hinzu.
   * ⚠️ Beabsichtigt simpel – kein vollständiger YAML-Merger.
   */
  private patchFrontmatterRaw(
    raw: string,
    inject: { id: string; type: string; coords: { q: number; r: number; region: string } }
  ): string {
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
      return raw.replace(fmRegex, block);
    } else {
      return block + "\n" + raw;
    }
  }
}
