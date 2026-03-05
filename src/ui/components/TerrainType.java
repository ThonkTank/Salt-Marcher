package ui.components;

/** Authoritative terrain vocabulary — used by renderer, editor palette, and CSS class mapping. */
public enum TerrainType {
    GRASSLAND("grassland", "Grasland"),
    FOREST   ("forest",    "Wald"),
    MOUNTAIN ("mountain",  "Gebirge"),
    WATER    ("water",     "Wasser"),
    DESERT   ("desert",    "W\u00fcste"),
    SWAMP    ("swamp",     "Sumpf");

    public final String key;
    public final String label;

    TerrainType(String key, String label) {
        this.key = key;
        this.label = label;
    }

    public String tileCssClass()   { return "hex-terrain-" + key; }
    public String swatchCssClass() { return "terrain-swatch-" + key; }

    /** Resolves a DB terrain_type string to the enum. Returns null for unknown values. */
    public static TerrainType fromKey(String key) {
        if (key == null) return null;
        for (TerrainType t : values()) {
            if (t.key.equals(key)) return t;
        }
        return null;
    }
}
