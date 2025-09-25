// src/core/hex-geom.ts
// Orientation: pointy-top, odd-r (row-offset)

export type Coord = { r: number; c: number };   // odd-r (row, col)
export type Axial = { q: number; r: number };
export type Cube  = { q: number; r: number; s: number };

const SQRT3 = Math.sqrt(3);

/* ---- odd-r <-> axial/cube ---- */
export function oddrToAxial(rc: Coord): Axial {
    const parity = rc.r & 1;
    const q = rc.c - ((rc.r - parity) / 2);
    return { q, r: rc.r };
}

export function axialToOddr(ax: Axial): Coord {
    const parity = ax.r & 1;
    const c = ax.q + ((ax.r - parity) / 2);
    return { r: ax.r, c: Math.round(c) };
}

export function axialToCube(ax: Axial): Cube {
    return { q: ax.q, r: ax.r, s: -ax.q - ax.r };
}

export function cubeToAxial(cu: Cube): Axial {
    return { q: cu.q, r: cu.r };
}

/* ---- Distanz / Interpolation / Runden ---- */
export function cubeDistance(a: Cube, b: Cube): number {
    return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}

export function oddrDistance(a: Coord, b: Coord): number {
    const A = axialToCube(oddrToAxial(a));
    const B = axialToCube(oddrToAxial(b));
    return cubeDistance(A, B);
}

export function cubeLerp(a: Cube, b: Cube, t: number): Cube {
    return {
        q: a.q + (b.q - a.q) * t,
        r: a.r + (b.r - a.r) * t,
        s: a.s + (b.s - a.s) * t,
    };
}

export function cubeRound(fr: Cube): Cube {
    let q = Math.round(fr.q), r = Math.round(fr.r), s = Math.round(fr.s);
    const qd = Math.abs(q - fr.q), rd = Math.abs(r - fr.r), sd = Math.abs(s - fr.s);
    if (qd > rd && qd > sd) q = -r - s;
    else if (rd > sd)       r = -q - s;
    else                    s = -q - r;
    return { q, r, s };
}

/* ---- Linie auf Hex-Gitter (Nachbar-Schritte, inkl. Endpunkte) ---- */
export function lineOddR(a: Coord, b: Coord): Coord[] {
    const A = axialToCube(oddrToAxial(a));
    const B = axialToCube(oddrToAxial(b));
    const N = cubeDistance(A, B);
    const out: Coord[] = [];
    for (let i = 0; i <= N; i++) {
        const t = N === 0 ? 0 : (i / N);
        const p = cubeRound(cubeLerp(A, B, t));
        out.push(axialToOddr(cubeToAxial(p)));
    }
    return out;
}

/* ---- Nachbarn für odd-r ---- */
const ODDR_DIRS_EVEN = [
    { dr:  0, dc: +1 }, { dr: -1, dc:  0 }, { dr: -1, dc: -1 },
{ dr:  0, dc: -1 }, { dr: +1, dc: -1 }, { dr: +1, dc:  0 },
] as const;

const ODDR_DIRS_ODD = [
    { dr:  0, dc: +1 }, { dr: -1, dc: +1 }, { dr: -1, dc:  0 },
{ dr:  0, dc: -1 }, { dr: +1, dc:  0 }, { dr: +1, dc: +1 },
] as const;

export function neighborsOddR(rc: Coord): Coord[] {
    const dirs = (rc.r & 1) ? ODDR_DIRS_ODD : ODDR_DIRS_EVEN;
    return dirs.map(d => ({ r: rc.r + d.dr, c: rc.c + d.dc }));
}

/* ---- Pixel <-> Hex (pointy-top) ---- */
export function axialToPixel(ax: Axial, size: number): { x: number; y: number } {
    // Red Blob (pointy): x = size*(√3*q + √3/2*r), y = size*(3/2*r)
    const x = size * (SQRT3 * ax.q + (SQRT3 / 2) * ax.r);
    const y = size * (1.5 * ax.r);
    return { x, y };
}

export function oddrToPixel(rc: Coord, size: number): { x: number; y: number } {
    return axialToPixel(oddrToAxial(rc), size);
}

export function pixelToAxial(x: number, y: number, size: number): Axial {
    // Invers zu axialToPixel
    const qf = (x * (SQRT3 / 3) - y / 3) / size;
    const rf = (y * (2 / 3)) / size;
    const rounded = cubeRound({ q: qf, r: rf, s: -qf - rf });
    return cubeToAxial(rounded);
}

export function pixelToOddr(x: number, y: number, size: number): Coord {
    return axialToOddr(pixelToAxial(x, y, size));
}

/* ---- Rendering-Helfer ---- */
export function hexPolygonPoints(cx: number, cy: number, r: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
        const ang = ((60 * i - 90) * Math.PI) / 180; // -90° => Spitze oben
        pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
    }
    return pts.join(" ");
}

export function hexPolygonPointsAtOddr(rc: Coord, size: number): string {
    const { x, y } = oddrToPixel(rc, size);
    return hexPolygonPoints(x, y, size);
}
