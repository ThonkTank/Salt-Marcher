export type HexOptions = { folder: string; prefix: string; radius: number; };

export function parseOptions(src: string): HexOptions {
    const d: HexOptions = { folder: "Hexes", prefix: "hex", radius: 42 };
    const lines = src.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
        const m = /^([a-zA-Z]+)\s*:\s*(.+)$/.exec(line);
        if (!m) continue;
        const k = m[1].toLowerCase(); const v = m[2].trim();
        if (k === "folder") d.folder = v;
        else if (k === "prefix") d.prefix = v;
        else if (k === "radius") { const n = Number(v); if (!Number.isNaN(n) && n > 10) d.radius = n; }
    }
    return d;
}
