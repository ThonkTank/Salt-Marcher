// ──────────────────────────────────────────────────────────────────────────────
// File: src/schemas.ts
// Purpose: Typen + leichte Laufzeitvalidierung (P0) für Tile/Session Frontmatter
// ──────────────────────────────────────────────────────────────────────────────
import { createLogger } from "./logger";
const logSchemas = createLogger("Schemas");


// ── Grundtypen
export type UUID = string;


export interface TileFrontmatter {
id: UUID;
coords: { q: number; r: number };
region: string;
terrain: { tier: number; speed_mod: number };
features: unknown[];
visibility: { elevation: number; blocks_view: boolean };
  terrain: { tier: number; speed_mod: number; name?: string };
}


export interface SessionFrontmatter {
session: string; // ISO-Date
party?: string[]; // Wikilinks als Klartext, P0 optional
}


// ── Default-Generatoren (für saubere Fallbacks)
export function defaultTileFrontmatter(q: number, r: number, region: string, uuid: UUID): TileFrontmatter {
return {
id: uuid,
coords: { q, r },
region,
terrain: { tier: 0, speed_mod: 1 },
features: [],
visibility: { elevation: 0, blocks_view: false },
};
}


// ── Laufzeitchecks: defensiv & leichtgewichtig
export function isTileFrontmatter(x: any): x is TileFrontmatter {
try {
return (
typeof x?.id === "string" &&
typeof x?.coords?.q === "number" &&
typeof x?.coords?.r === "number" &&
typeof x?.region === "string" &&
typeof x?.terrain?.tier === "number" &&
typeof x?.terrain?.speed_mod === "number" &&
Array.isArray(x?.features) &&
typeof x?.visibility?.elevation === "number" &&
typeof x?.visibility?.blocks_view === "boolean"
);
} catch (err) {
logSchemas.error("isTileFrontmatter crash", { err });
return false;
}
}


export function isSessionFrontmatter(x: any): x is SessionFrontmatter {
return typeof x?.session === "string";
}


// ── Hilfsfunktionen
export function uuidV4(): UUID {
// RFC4122 v4 – kompatibel mit Browser/Obsidian
const g = (a?: number) => (a ? (a ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (a / 4)))).toString(16) : "");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
return ("10000000-1000-4000-8000-100000000000" as any).replace(/[018]/g, g);
}
