export type HexOptions = {
    folder: string;
    /**
     * Neuer, eindeutiger Präfix-Schlüssel für Dateinamen/Überschriften der Tiles.
     * Bleibt unabhängig vom Legacy-`prefix` erhalten.
     */
    folderPrefix: string;
    /**
     * Legacy-Alias. Wird weiter geparst, aber nicht mehr verwendet.
     * Beim Schreiben neuer Karten wird derselbe Wert für `prefix` und `folderPrefix` gesetzt
     * (siehe `map-maker.ts`) für Backwards-Kompatibilität.
     */
    prefix?: string;
    radius: number;
};

/**
 * Parst Hex-Map-Optionen robust:
 * - Falls der übergebene Text einen ```hex3x3 Codeblock enthält, wird nur dessen Inhalt ausgewertet.
 * - Andernfalls wird der gesamte String als Options-Text interpretiert (kompatibel zur bisherigen Nutzung).
 * - Unterstützt Keys: `folder`, `folderPrefix`, `prefix` (legacy), `radius`.
 */
export function parseOptions(src: string): HexOptions {
    const blockMatch = src.match(/```[\t ]*hex3x3\b[\s\S]*?\n([\s\S]*?)\n```/i);
    const body = blockMatch ? blockMatch[1] : src;

    const d: HexOptions = { folder: "Hexes", folderPrefix: "Hex", prefix: "hex", radius: 42 };
    const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
        const m = /^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.+)$/.exec(line);
        if (!m) continue;
        const k = m[1].toLowerCase();
        const v = m[2].trim();
        if (k === "folder") d.folder = v;
        else if (k === "folderprefix") d.folderPrefix = v;
        else if (k === "prefix") d.prefix = v;
        else if (k === "radius") {
            const n = Number(v);
            if (!Number.isNaN(n) && n > 10) d.radius = n;
        }
    }
    // Falls nur `prefix` gesetzt ist, als Fallback für `folderPrefix` verwenden
    if (!d.folderPrefix && d.prefix) d.folderPrefix = d.prefix;
    // Normalize: Mindest-Radius 12, um sinnvolle Anzeige zu garantieren
    if (!(d.radius > 0)) d.radius = 42;
    if (d.radius < 12) d.radius = 12;
    return d;
}
