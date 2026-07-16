package features.hex.domain.map;

public enum HexEditorMode {
    SELECT,
    PAINT_TERRAIN,
    PLACE_MARKER,
    MOVE_PARTY;

    public static HexEditorMode defaultMode() {
        return SELECT;
    }
}
