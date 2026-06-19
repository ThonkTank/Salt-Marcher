package src.view.leftbartabs.hexmap;

final class HexMapToolContentPartModel {

    static final String SELECT = "SELECT";
    static final String PAINT_TERRAIN = "PAINT_TERRAIN";
    static final String PLACE_MARKER = "PLACE_MARKER";
    static final String MOVE_PARTY = "MOVE_PARTY";

    private HexMapToolContentPartModel() {
    }

    static String normalize(String key) {
        return switch (key == null ? "" : key.trim()) {
            case PAINT_TERRAIN -> PAINT_TERRAIN;
            case PLACE_MARKER -> PLACE_MARKER;
            case MOVE_PARTY -> MOVE_PARTY;
            default -> SELECT;
        };
    }

    static String label(String key) {
        return switch (normalize(key)) {
            case PAINT_TERRAIN -> "Terrain";
            case PLACE_MARKER -> "Marker";
            case MOVE_PARTY -> "Reisegruppe";
            default -> "Auswahl";
        };
    }
}
