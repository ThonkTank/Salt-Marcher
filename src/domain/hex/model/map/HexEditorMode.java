package src.domain.hex.model.map;

public enum HexEditorMode {
    SELECT,
    PAINT_TERRAIN,
    PLACE_MARKER;

    public static HexEditorMode defaultMode() {
        return SELECT;
    }
}
