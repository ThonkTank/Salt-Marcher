package features.hex.adapter.javafx.hexmap;

import java.util.List;
import features.hex.api.HexEditorMode;
import features.hex.api.HexMarkerKind;
import features.hex.api.HexTerrain;

final class HexMapVocabulary {

    static final HexEditorMode DEFAULT_TOOL = HexEditorMode.SELECT;
    static final HexTerrain DEFAULT_TERRAIN = HexTerrain.GRASSLAND;
    static final HexMarkerKind DEFAULT_MARKER_TYPE = HexMarkerKind.LANDMARK;
    static final List<Option<HexEditorMode>> TOOL_OPTIONS = List.of(
            new Option<>(HexEditorMode.SELECT, "Auswahl"),
            new Option<>(HexEditorMode.PAINT_TERRAIN, "Terrain"),
            new Option<>(HexEditorMode.PLACE_MARKER, "Marker"),
            new Option<>(HexEditorMode.MOVE_PARTY, "Reisegruppe"));
    static final List<Option<HexTerrain>> TERRAIN_OPTIONS = List.of(
            new Option<>(HexTerrain.GRASSLAND, "Grasland"),
            new Option<>(HexTerrain.FOREST, "Wald"),
            new Option<>(HexTerrain.MOUNTAINS, "Gebirge"),
            new Option<>(HexTerrain.WATER, "Wasser"),
            new Option<>(HexTerrain.DESERT, "Wueste"),
            new Option<>(HexTerrain.SWAMP, "Sumpf"));
    static final List<Option<HexMarkerKind>> MARKER_TYPE_OPTIONS = List.of(
            new Option<>(HexMarkerKind.SETTLEMENT, "Siedlung"),
            new Option<>(HexMarkerKind.LANDMARK, "Landmarke"),
            new Option<>(HexMarkerKind.DANGER, "Gefahr"),
            new Option<>(HexMarkerKind.RESOURCE, "Ressource"));

    private HexMapVocabulary() {
    }

    static HexEditorMode tool(HexEditorMode value) {
        return value == null ? DEFAULT_TOOL : value;
    }

    static HexTerrain terrain(HexTerrain value) {
        return value == null ? DEFAULT_TERRAIN : value;
    }

    static HexMarkerKind markerKind(HexMarkerKind value) {
        return value == null ? DEFAULT_MARKER_TYPE : value;
    }

    static String label(HexEditorMode mode) {
        return label(TOOL_OPTIONS, mode == null ? DEFAULT_TOOL : mode);
    }

    static String label(HexTerrain terrain) {
        return label(TERRAIN_OPTIONS, terrain == null ? DEFAULT_TERRAIN : terrain);
    }

    static String label(HexMarkerKind kind) {
        return label(MARKER_TYPE_OPTIONS, kind == null ? DEFAULT_MARKER_TYPE : kind);
    }

    static int defaultMarkerTypeOptionIndex() {
        return optionIndex(MARKER_TYPE_OPTIONS, DEFAULT_MARKER_TYPE);
    }

    static <T> int optionIndex(List<Option<T>> options, T value) {
        for (int index = 0; index < options.size(); index++) {
            if (options.get(index).value().equals(value)) {
                return index;
            }
        }
        return 0;
    }

    static <T> T optionValue(List<Option<T>> options, int optionIndex, T fallback) {
        if (optionIndex >= 0 && optionIndex < options.size()) {
            return options.get(optionIndex).value();
        }
        return fallback;
    }

    private static <T> String label(List<Option<T>> options, T value) {
        return options.stream()
                .filter(option -> option.value().equals(value))
                .findFirst()
                .map(Option::label)
                .orElse("");
    }

    record Option<T>(T value, String label) {

        Option {
            label = label == null ? "" : label.trim();
        }

        @Override
        public String toString() {
            return label;
        }
    }
}
