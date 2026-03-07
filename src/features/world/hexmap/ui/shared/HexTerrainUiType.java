package features.world.hexmap.ui.shared;

/** Autoritatives Gelaendevokabular fuer Hexmap-Rendering und Editor-Palette. */
public enum HexTerrainUiType {
    GRASSLAND("grassland", "Grasland"),
    FOREST   ("forest",    "Wald"),
    MOUNTAIN ("mountain",  "Gebirge"),
    WATER    ("water",     "Wasser"),
    DESERT   ("desert",    "W\u00fcste"),
    SWAMP    ("swamp",     "Sumpf");

    public final String key;
    public final String label;

    HexTerrainUiType(String key, String label) {
        this.key = key;
        this.label = label;
    }

    public String tileCssClass()   { return "hex-terrain-" + key; }
    public String swatchCssClass() { return "terrain-swatch-" + key; }

    /** Loest einen DB-terrain_type-String auf das Enum auf. Bei unbekannten Werten wird null geliefert. */
    public static HexTerrainUiType fromKey(String key) {
        if (key == null) return null;
        for (HexTerrainUiType terrainType : values()) {
            if (terrainType.key.equals(key)) return terrainType;
        }
        return null;
    }
}
