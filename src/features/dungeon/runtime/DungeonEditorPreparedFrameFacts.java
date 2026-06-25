package src.features.dungeon.runtime;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonOverlaySettings;

public record DungeonEditorPreparedFrameFacts(
        List<MapEntry> mapEntries,
        String selectedMapKey,
        long selectedMapIdValue,
        List<Integer> reachableLevels,
        boolean busy,
        String statusText,
        String viewModeKey,
        String viewModeLabel,
        DungeonOverlaySettings overlaySettings,
        OverlayFrame overlay,
        int projectionLevel,
        String selectedToolKey,
        String selectedToolLabel,
        MapInteractionFrame mapInteractionFrame
) {
    public DungeonEditorPreparedFrameFacts {
        mapEntries = mapEntries == null ? List.of() : List.copyOf(mapEntries);
        selectedMapKey = selectedMapKey == null ? "" : selectedMapKey;
        selectedMapIdValue = Math.max(0L, selectedMapIdValue);
        reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
        statusText = statusText == null ? "" : statusText;
        String normalizedViewModeKey = normalizeViewModeKey(viewModeKey);
        viewModeKey = normalizedViewModeKey;
        viewModeLabel = viewModeLabel == null || viewModeLabel.isBlank()
                ? labelForViewMode(normalizedViewModeKey)
                : viewModeLabel;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        overlay = overlay == null ? OverlayFrame.from(overlaySettings) : overlay;
        selectedToolKey = selectedToolKey == null || selectedToolKey.isBlank() ? "SELECT" : selectedToolKey;
        selectedToolLabel = selectedToolLabel == null || selectedToolLabel.isBlank()
                ? DungeonEditorTool.SELECT.displayLabel()
                : selectedToolLabel;
        mapInteractionFrame = mapInteractionFrame == null ? MapInteractionFrame.empty() : mapInteractionFrame;
    }

    public static DungeonEditorPreparedFrameFacts empty() {
        return new DungeonEditorPreparedFrameFacts(
                List.of(),
                "",
                0L,
                List.of(0),
                false,
                "",
                "GRID",
                "Grid",
                DungeonOverlaySettings.defaults(),
                OverlayFrame.from(DungeonOverlaySettings.defaults()),
                0,
                "SELECT",
                DungeonEditorTool.SELECT.displayLabel(),
                MapInteractionFrame.empty());
    }

    public static String normalizeViewModeKey(String viewModeKey) {
        return "GRAPH".equals(viewModeKey) || "Graph".equals(viewModeKey) ? "GRAPH" : "GRID";
    }

    public static String labelForViewMode(String viewModeKey) {
        return "GRAPH".equals(normalizeViewModeKey(viewModeKey)) ? "Graph" : "Grid";
    }

    public record MapEntry(String key, long mapIdValue, String mapName, long revision) {
        public MapEntry {
            key = key == null ? "" : key;
            mapIdValue = Math.max(0L, mapIdValue);
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0L, revision);
        }
    }

    public record OverlayFrame(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels,
            String selectedLevelsText,
            String overlayLabel
    ) {
        public OverlayFrame {
            modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
            selectedLevelsText = selectedLevelsText == null ? "" : selectedLevelsText.strip();
            overlayLabel = overlayLabel == null || overlayLabel.isBlank()
                    ? overlayLabelFor(modeKey)
                    : overlayLabel;
        }

        public static OverlayFrame from(DungeonOverlaySettings overlaySettings) {
            DungeonOverlaySettings safeOverlay =
                    Objects.requireNonNullElseGet(overlaySettings, DungeonOverlaySettings::defaults);
            List<Integer> selectedLevels = safeOverlay.selectedLevels();
            return new OverlayFrame(
                    safeOverlay.modeKey(),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    selectedLevels,
                    selectedLevels == null || selectedLevels.isEmpty()
                            ? ""
                            : selectedLevels.stream().map(String::valueOf).collect(Collectors.joining(", ")),
                    overlayLabelFor(safeOverlay.modeKey()));
        }

        private static String overlayLabelFor(String modeKey) {
            return switch (modeKey) {
                case "NEARBY" -> "Nahe Ebenen";
                case "SELECTED" -> "Ausgewählte Ebenen";
                default -> "Overlays aus";
            };
        }
    }

    public record MapInteractionFrame(
            Map<String, DungeonEditorRuntimePointerTarget> pointerTargets,
            List<String> previewHandleHitRefs
    ) {
        public MapInteractionFrame {
            pointerTargets = pointerTargets == null ? Map.of() : Map.copyOf(pointerTargets);
            previewHandleHitRefs = previewHandleHitRefs == null ? List.of() : List.copyOf(previewHandleHitRefs);
        }

        public static MapInteractionFrame empty() {
            return new MapInteractionFrame(Map.of(), List.of());
        }

        public static MapInteractionFrame from(DungeonEditorMapSurfaceSnapshot snapshot) {
            return DungeonEditorMapInteractionFrameAssembler.from(snapshot);
        }
    }

}
