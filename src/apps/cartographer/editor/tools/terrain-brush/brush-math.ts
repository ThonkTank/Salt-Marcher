// src/apps/cartographer/editor/tools/terrain-brush/brush-math.ts

// --- Types ---
export type Coord = { r: number; c: number };

// --- Odd-R (horizontal) ⇄ Axial Helpers ---
// Red Blob Games: odd-r -> axial
function oddR_toAxial(rc: Coord): { q: number; r: number } {
    // q = col - (row - (row&1)) / 2
    const q = rc.c - ((rc.r - (rc.r & 1)) >> 1);
    return { q, r: rc.r };
}

function axialDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
    // cube distance without building full cubes
    const dq = Math.abs(a.q - b.q);
    const dr = Math.abs(a.r - b.r);
    const ds = Math.abs((-a.q - a.r) - (-b.q - b.r)); // s = -q - r
    return Math.max(dq, dr, ds);
}

// Öffentliche Distanz für odd-r Grids
export function hexDistanceOddR(a: Coord, b: Coord): number {
    const A = oddR_toAxial(a);
    const B = oddR_toAxial(b);
    return axialDistance(A, B);
}

/**
 * Gibt alle Koordinaten im (inkl.) Radius um center zurück (odd-r offset grid).
 * - Reihenfolge: nach Distanz (0..radius), dann r, dann c (stabil für Tests).
 * - Keine Bounds: Caller filtert ggf. auf gültiges Grid.
 */
export function coordsInRadius(center: Coord, radius: number): Coord[] {
    const out: Coord[] = [];
    for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
            const r = center.r + dr;

            // odd-r horizontale Verschiebung für „Sichtfenster“ beim Scannen:
            // (gleichzeitig korrekt, wenn wir anschließend mit axial-Distanz filtern)
            const c = center.c + dc + ((center.r & 1) ? Math.floor((dr + 1) / 2) : Math.floor(dr / 2));

            if (hexDistanceOddR(center, { r, c }) <= radius) {
                out.push({ r, c });
            }
        }
    }

    // stabile Sortierung (optional, aber hilfreich)
    out.sort((A, B) => {
        const da = hexDistanceOddR(center, A);
        const db = hexDistanceOddR(center, B);
        if (da !== db) return da - db;
        if (A.r !== B.r) return A.r - B.r;
        return A.c - B.c;
    });

    return out;
}
