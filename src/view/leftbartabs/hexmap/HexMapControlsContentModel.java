package src.view.leftbartabs.hexmap;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.hex.published.HexEditorSnapshot;

public final class HexMapControlsContentModel {

    private static final List<ToolOption> TOOL_OPTIONS = List.of(
            new ToolOption(HexMapToolContentPartModel.SELECT, HexMapToolContentPartModel.label(HexMapToolContentPartModel.SELECT)),
            new ToolOption(HexMapToolContentPartModel.PAINT_TERRAIN, HexMapToolContentPartModel.label(HexMapToolContentPartModel.PAINT_TERRAIN)),
            new ToolOption(HexMapToolContentPartModel.PLACE_MARKER, HexMapToolContentPartModel.label(HexMapToolContentPartModel.PLACE_MARKER)),
            new ToolOption(HexMapToolContentPartModel.MOVE_PARTY, HexMapToolContentPartModel.label(HexMapToolContentPartModel.MOVE_PARTY)));

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.initial());

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    Projection currentProjection() {
        return projection.get();
    }

    String resolvedToolKey(int optionIndex) {
        return currentProjection().toolKey(optionIndex);
    }

    String resolvedToolKey(String candidateToolKey) {
        return currentProjection().toolKey(candidateToolKey);
    }

    String resolvedTerrainKey(int optionIndex) {
        return currentProjection().terrainKey(optionIndex);
    }

    String resolvedTerrainKey(String candidateTerrainKey) {
        return currentProjection().terrainKey(candidateTerrainKey);
    }

    boolean isPaintTerrainTool(String candidateToolKey) {
        return currentProjection().isTool(candidateToolKey, HexMapToolContentPartModel.PAINT_TERRAIN);
    }

    boolean isMovePartyTool(String candidateToolKey) {
        return currentProjection().isTool(candidateToolKey, HexMapToolContentPartModel.MOVE_PARTY);
    }

    boolean isPlaceMarkerTool(String candidateToolKey) {
        return currentProjection().isTool(candidateToolKey, HexMapToolContentPartModel.PLACE_MARKER);
    }

    void applySnapshot(HexEditorSnapshot snapshot) {
        projection.set(Projection.from(snapshot));
    }

    record Projection(
            boolean mapLoaded,
            List<ToolOption> tools,
            String activeToolKey,
            List<HexMapVocabularyContentPartModel.Option> terrains,
            String activeTerrainKey
    ) {

        Projection {
            tools = tools == null ? List.of() : List.copyOf(tools);
            activeToolKey = safeText(activeToolKey);
            terrains = terrains == null ? List.of() : List.copyOf(terrains);
            activeTerrainKey = safeText(activeTerrainKey);
        }

        static Projection initial() {
            return new Projection(
                    false,
                    TOOL_OPTIONS,
                    HexMapToolContentPartModel.SELECT,
                    HexMapVocabularyContentPartModel.TERRAIN_OPTIONS,
                    HexMapVocabularyContentPartModel.DEFAULT_TERRAIN);
        }

        static Projection from(HexEditorSnapshot snapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty("Keine Hex-Karte geladen.")
                    : snapshot;
            return new Projection(
                    safeSnapshot.selectedMap().isPresent(),
                    TOOL_OPTIONS,
                    safeSnapshot.activeTool(),
                    HexMapVocabularyContentPartModel.TERRAIN_OPTIONS,
                    safeSnapshot.activeTerrain());
        }

        List<String> terrainLabels() {
            return terrains.stream()
                    .map(HexMapVocabularyContentPartModel.Option::label)
                    .toList();
        }

        List<String> toolLabels() {
            return tools.stream()
                    .map(ToolOption::label)
                    .toList();
        }

        int activeToolOptionIndex() {
            return toolOptionIndex(activeToolKey);
        }

        int paintTerrainToolOptionIndex() {
            return toolOptionIndex(HexMapToolContentPartModel.PAINT_TERRAIN);
        }

        private int toolOptionIndex(String toolKey) {
            for (int index = 0; index < tools.size(); index++) {
                if (tools.get(index).key().equals(toolKey)) {
                    return index;
                }
            }
            return 0;
        }

        int activeTerrainOptionIndex() {
            int index = optionIndex(terrains, activeTerrainKey);
            return index >= 0 ? index : optionIndex(terrains, HexMapVocabularyContentPartModel.DEFAULT_TERRAIN);
        }

        String terrainKey(int optionIndex) {
            if (optionIndex >= 0 && optionIndex < terrains.size()) {
                return terrains.get(optionIndex).key();
            }
            return optionKey(terrains, HexMapVocabularyContentPartModel.DEFAULT_TERRAIN);
        }

        String terrainKey(String candidateTerrainKey) {
            String safeCandidate = safeText(candidateTerrainKey);
            return terrains.stream()
                    .map(HexMapVocabularyContentPartModel.Option::key)
                    .filter(safeCandidate::equals)
                    .findFirst()
                    .orElseGet(() -> optionKey(terrains, HexMapVocabularyContentPartModel.DEFAULT_TERRAIN));
        }

        String toolKey(int optionIndex) {
            return optionIndex >= 0 && optionIndex < tools.size()
                    ? tools.get(optionIndex).key()
                    : HexMapToolContentPartModel.SELECT;
        }

        String toolKey(String candidateToolKey) {
            String safeCandidate = safeText(candidateToolKey);
            return tools.stream()
                    .map(ToolOption::key)
                    .filter(safeCandidate::equals)
                    .findFirst()
                    .orElse(HexMapToolContentPartModel.SELECT);
        }

        boolean isTool(String candidateToolKey, String expectedToolKey) {
            return toolKey(candidateToolKey).equals(expectedToolKey);
        }

    }

    record ToolOption(String key, String label) {

        ToolOption {
            key = safeText(key);
            label = safeText(label);
        }

        @Override
        public String toString() {
            return label;
        }
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }

    private static int optionIndex(
            List<HexMapVocabularyContentPartModel.Option> options,
            String key
    ) {
        String safeKey = safeText(key);
        for (int index = 0; index < options.size(); index++) {
            if (options.get(index).key().equals(safeKey)) {
                return index;
            }
        }
        return -1;
    }

    private static String optionKey(
            List<HexMapVocabularyContentPartModel.Option> options,
            String fallback
    ) {
        String safeFallback = safeText(fallback);
        return options.stream()
                .map(HexMapVocabularyContentPartModel.Option::key)
                .filter(safeFallback::equals)
                .findFirst()
                .orElse("");
    }
}
