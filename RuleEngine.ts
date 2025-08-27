// ──────────────────────────────────────────────────────────────────────────────
// File: src/RuleEngine.ts
// Purpose: P0-Regeln/Resolver für Terrain-Speed-Mod aus Tile-Frontmatter
// ──────────────────────────────────────────────────────────────────────────────

import type { App, TFile } from "obsidian";
import { createLogger } from "./logger";
import type { TileNoteService } from "./TileNoteService";
import type { TerrainInfo } from "./TravelProcessor";

const log = createLogger("Rules");

export function makeTerrainResolver(app: App, tileNotes: TileNoteService) {
  return async (hex: { q: number; r: number }): Promise<TerrainInfo> => {
    try {
      const found = await tileNotes.find(hex.q, hex.r);
      if (!found?.file) {
        log.debug("Keine Tile-Note gefunden → terrain=unknown×1", hex);
        return { name: "unknown", speedMod: 1 };
      }

      const cache = app.metadataCache.getFileCache(found.file as TFile);
      // Erwartetes Schema (P0): frontmatter.terrain.speed_mod & evtl. name
      const fm: any = cache?.frontmatter ?? {};
      const terrain = fm?.terrain ?? {};
      const name = terrain?.name ?? "unknown";
      const modRaw = terrain?.speed_mod;
      const speedMod = Number.isFinite(modRaw) ? Number(modRaw) : 1;

      if (!(cache && fm)) {
        log.warn("Fehlendes/ungültiges Frontmatter, fallback ×1", { path: found.path });
      }

      return { name, speedMod };
    } catch (e) {
      log.warn("TerrainResolver-Exception, fallback ×1", { hex, error: String(e) });
      return { name: "unknown", speedMod: 1 };
    }
  };
}
