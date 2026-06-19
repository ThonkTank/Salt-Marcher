package src.view.leftbartabs.hexmap;

import java.util.List;

final class HexMapVocabularyContentPartModel {

    static final String DEFAULT_TERRAIN = "GRASSLAND";
    static final String DEFAULT_MARKER_TYPE = "LANDMARK";
    static final List<Option> TERRAIN_OPTIONS = List.of(
            new Option(DEFAULT_TERRAIN, "Grasland"),
            new Option("FOREST", "Wald"),
            new Option("MOUNTAINS", "Gebirge"),
            new Option("WATER", "Wasser"),
            new Option("DESERT", "Wueste"),
            new Option("SWAMP", "Sumpf"));
    static final List<Option> MARKER_TYPE_OPTIONS = List.of(
            new Option("SETTLEMENT", "Siedlung"),
            new Option(DEFAULT_MARKER_TYPE, "Landmarke"),
            new Option("DANGER", "Gefahr"),
            new Option("RESOURCE", "Ressource"));

    private HexMapVocabularyContentPartModel() {
    }

    static String terrainLabel(String terrain) {
        return label(TERRAIN_OPTIONS, terrain, DEFAULT_TERRAIN);
    }

    static String markerLabel(String markerType) {
        return label(MARKER_TYPE_OPTIONS, markerType, DEFAULT_MARKER_TYPE);
    }

    private static String label(List<Option> options, String key, String fallback) {
        String normalized = safeKey(key, fallback);
        return options.stream()
                .filter(option -> option.key().equals(normalized))
                .findFirst()
                .map(Option::label)
                .orElseGet(() -> options.stream()
                        .filter(option -> option.key().equals(fallback))
                        .findFirst()
                        .map(Option::label)
                        .orElse(""));
    }

    private static String safeKey(String text, String fallback) {
        String safeText = text == null ? "" : text.trim();
        return safeText.isBlank() ? fallback : safeText;
    }

    record Option(String key, String label) {

        Option {
            key = key == null ? "" : key.trim();
            label = label == null ? "" : label.trim();
        }

        @Override
        public String toString() {
            return label;
        }
    }
}
