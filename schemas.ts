// ──────────────────────────────────────────────────────────────────────────────
// File: src/schemas.ts
// Purpose: Typen + leichte Laufzeitvalidierung (P0) für Tile/Session Frontmatter
// Notes: Enthält reine Typen + *leichte* Guards (kein Zod), sowie Helper zum
//        Generieren von UUIDs. Alle Guards sind extrem gesprächig im Logger.
// ──────────────────────────────────────────────────────────────────────────────
import { createLogger } from "./logger";
const logSchemas = createLogger("Schemas");

// ── Grundtypen
export type UUID = string;

// ── Tile Schema (P0 minimal)
export interface TileFrontmatter {
  id: UUID;
  coords: { q: number; r: number };
  region: string;
  terrain?: {
    tier?: number;            // 0..3 (0 = easy, 3 = hard)
    speed_mod?: number;       // Multiplikator für Reisezeit (1 = normal)
  };
  features?: string[];        // Freitext-Tags: "river", "road", "forest", ...
  visibility?: {
    elevation?: number;       // Meter über NN (für LOS/Travel)
    blocks_view?: boolean;    // true = blockiert Fernsicht
  };
}

// ── Session Schema (P0 minimal)
export interface SessionFrontmatter {
  session: string;         // z.B. "2025-08-20 #12"
  date?: string;           // ISO Datum
  party?: string[];        // optionale Liste von Spielern/PCs
  visited?: Array<{ q: number; r: number; region?: string }>;
}

// ── Type Guards (sehr gesprächig für Debug)
export function isTileFrontmatter(x: unknown): x is TileFrontmatter {
  const ok =
    !!x &&
    typeof (x as any).id === "string" &&
    typeof (x as any).region === "string" &&
    typeof (x as any).coords?.q === "number" &&
    typeof (x as any).coords?.r === "number";
  if (!ok) {
    logSchemas.warn(
      "[isTileFrontmatter] Validation failed.",
      {
        hasId: typeof (x as any)?.id,
        hasRegion: typeof (x as any)?.region,
        qType: typeof (x as any)?.coords?.q,
        rType: typeof (x as any)?.coords?.r,
        value: x
      }
    );
  } else {
    logSchemas.debug("[isTileFrontmatter] OK", { id: (x as any).id, coords: (x as any).coords, region: (x as any).region });
  }
  return ok;
}

export function isSessionFrontmatter(x: unknown): x is SessionFrontmatter {
  const ok = !!x && typeof (x as any).session === "string";
  if (!ok) {
    logSchemas.warn("[isSessionFrontmatter] Validation failed.", { value: x, sessionType: typeof (x as any)?.session });
  } else {
    logSchemas.debug("[isSessionFrontmatter] OK", { session: (x as any).session });
  }
  return ok;
}

// ── Normalizer: nimmt *beliebiges* Objekt und erzeugt minimal gültiges Schema
export function normalizeTileFrontmatter(x: Partial<TileFrontmatter> | unknown): TileFrontmatter | null {
  if (!x || typeof x !== "object") {
    logSchemas.error("[normalizeTileFrontmatter] Input ist kein Objekt.", { value: x });
    return null;
  }
  const q = Number((x as any)?.coords?.q);
  const r = Number((x as any)?.coords?.r);
  const region = String((x as any)?.region ?? "").trim();
  const id = String((x as any)?.id ?? uuidV4());

  if (!Number.isFinite(q) || !Number.isFinite(r) || !region) {
    logSchemas.error("[normalizeTileFrontmatter] Pflichtfelder fehlen/inkorrekt.", {
      q, r, region, id, input: x
    });
    return null;
  }

  const normalized: TileFrontmatter = {
    id,
    coords: { q, r },
    region,
    terrain: {
      tier: clampInt((x as any)?.terrain?.tier, 0, 3, 0, "terrain.tier"),
      speed_mod: clampFloat((x as any)?.terrain?.speed_mod, 0.1, 5, 1, "terrain.speed_mod")
    },
    features: Array.isArray((x as any)?.features) ? (x as any).features.map(String) : [],
    visibility: {
      elevation: toFiniteOrUndefined((x as any)?.visibility?.elevation, "visibility.elevation"),
      blocks_view: toBoolOrUndefined((x as any)?.visibility?.blocks_view, "visibility.blocks_view")
    }
  };

  logSchemas.info("[normalizeTileFrontmatter] Normalized tile frontmatter.", normalized);
  return normalized;
}

// ── Hilfsfunktionen: defensiv + gesprächig
function clampInt(v: unknown, min: number, max: number, fallback: number, field: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    logSchemas.debug(`[clampInt] Fallback for ${field}`, { provided: v, used: fallback, range: [min, max] });
    return fallback;
  }
  return n;
}

function clampFloat(v: unknown, min: number, max: number, fallback: number, field: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    logSchemas.debug(`[clampFloat] Fallback for ${field}`, { provided: v, used: fallback, range: [min, max] });
    return fallback;
  }
  return n;
}

function toFiniteOrUndefined(v: unknown, field: string): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    if (v !== undefined) logSchemas.debug(`[toFiniteOrUndefined] Dropping invalid ${field}`, { provided: v });
    return undefined;
  }
  return n;
}

function toBoolOrUndefined(v: unknown, field: string): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v !== undefined) logSchemas.debug(`[toBoolOrUndefined] Dropping invalid ${field}`, { provided: v });
  return undefined;
}

// ── Utils
export function uuidV4(): UUID {
  // RFC4122 v4 – kompatibel mit Browser/Obsidian (Crypto API)
  const g = (a?: number) => (a ? (a ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (a / 4)))).toString(16) : "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ("10000000-1000-4000-8000-100000000000" as any).replace(/[018]/g, g);
}
