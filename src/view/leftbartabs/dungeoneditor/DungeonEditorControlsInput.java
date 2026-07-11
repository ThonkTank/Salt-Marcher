package src.view.leftbartabs.dungeoneditor;

import java.util.Locale;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.features.dungeon.runtime.DungeonEditorOverlaySettings;

record DungeonEditorControlsInput(
        MapInput map,
        ToolInput tool,
        ProjectionInput projection,
        OverlayInput overlay
) {

    DungeonEditorControlsInput {
        map = map == null ? MapInput.none() : map;
        tool = tool == null ? ToolInput.none() : tool;
        projection = projection == null ? ProjectionInput.none() : projection;
        overlay = overlay == null ? OverlayInput.none() : overlay;
    }

    static DungeonEditorControlsInput fromLegacy(DungeonEditorControlsViewInputEvent event) {
        DungeonEditorControlsViewInputEvent safeEvent = event == null
                ? new DungeonEditorControlsViewInputEvent(null, null, null, null)
                : event;
        return new DungeonEditorControlsInput(
                MapInput.fromLegacy(safeEvent.map()),
                ToolInput.fromLegacy(safeEvent.tool()),
                ProjectionInput.fromLegacy(safeEvent.projection()),
                OverlayInput.fromLegacy(safeEvent.overlay()));
    }

    DungeonEditorControlsViewInputEvent toLegacyEvent() {
        return new DungeonEditorControlsViewInputEvent(
                map.toLegacySnapshot(),
                tool.toLegacySnapshot(),
                projection.toLegacySnapshot(),
                overlay.toLegacySnapshot());
    }

    record MapInput(
            long selectedMapIdValue,
            String editorDraftName,
            boolean editorInputObserved,
            boolean createControlActivated,
            boolean renameControlActivated,
            boolean deleteControlActivated,
            boolean dismissControlActivated,
            boolean submitControlActivated,
            boolean confirmDeleteControlActivated,
            boolean reloadControlActivated
    ) {
        MapInput {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            editorDraftName = editorDraftName == null ? "" : editorDraftName;
        }

        static MapInput none() {
            return new MapInput(0L, "", false, false, false, false, false, false, false, false);
        }

        static MapInput fromLegacy(DungeonEditorControlsViewInputEvent.MapSnapshot snapshot) {
            DungeonEditorControlsViewInputEvent.MapSnapshot safeSnapshot = snapshot == null
                    ? new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, "", false, false, false, false,
                            false, false, false, false)
                    : snapshot;
            return new MapInput(
                    safeSnapshot.selectedMapIdValue(),
                    safeSnapshot.editorDraftName(),
                    safeSnapshot.editorInputObserved(),
                    safeSnapshot.createControlActivated(),
                    safeSnapshot.renameControlActivated(),
                    safeSnapshot.deleteControlActivated(),
                    safeSnapshot.dismissControlActivated(),
                    safeSnapshot.submitControlActivated(),
                    safeSnapshot.confirmDeleteControlActivated(),
                    safeSnapshot.reloadControlActivated());
        }

        DungeonEditorControlsViewInputEvent.MapSnapshot toLegacySnapshot() {
            return new DungeonEditorControlsViewInputEvent.MapSnapshot(
                    selectedMapIdValue,
                    editorDraftName,
                    editorInputObserved,
                    createControlActivated,
                    renameControlActivated,
                    deleteControlActivated,
                    dismissControlActivated,
                    submitControlActivated,
                    confirmDeleteControlActivated,
                    reloadControlActivated);
        }
    }

    record ToolInput(
            String requestedFamilyKey,
            DungeonEditorTool selectedTool,
            String selectedOptionKey,
            boolean dismissControlActivated
    ) {
        ToolInput {
            requestedFamilyKey = requestedFamilyKey == null ? "" : requestedFamilyKey.strip();
            selectedOptionKey = selectedOptionKey == null ? "" : selectedOptionKey.strip();
        }

        static ToolInput none() {
            return new ToolInput("", null, "", false);
        }

        static ToolInput fromLegacy(DungeonEditorControlsViewInputEvent.ToolSnapshot snapshot) {
            DungeonEditorControlsViewInputEvent.ToolSnapshot safeSnapshot = snapshot == null
                    ? new DungeonEditorControlsViewInputEvent.ToolSnapshot("", "", false)
                    : snapshot;
            return new ToolInput(
                    safeSnapshot.requestedFamilyKey(),
                    parseTool(safeSnapshot.selectedToolKey()),
                    safeSnapshot.selectedOptionKey(),
                    safeSnapshot.dismissControlActivated());
        }

        DungeonEditorControlsViewInputEvent.ToolSnapshot toLegacySnapshot() {
            return new DungeonEditorControlsViewInputEvent.ToolSnapshot(
                    requestedFamilyKey,
                    selectedTool == null ? "" : selectedTool.name(),
                    selectedOptionKey,
                    dismissControlActivated);
        }

        private static DungeonEditorTool parseTool(String toolKey) {
            String normalized = normalizedName(toolKey);
            if (normalized.isBlank()) {
                return null;
            }
            try {
                return DungeonEditorTool.valueOf(normalized);
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }
    }

    record ProjectionInput(
            DungeonEditorViewMode viewMode,
            int levelShift
    ) {
        static ProjectionInput none() {
            return new ProjectionInput(null, 0);
        }

        static ProjectionInput fromLegacy(DungeonEditorControlsViewInputEvent.ProjectionSnapshot snapshot) {
            DungeonEditorControlsViewInputEvent.ProjectionSnapshot safeSnapshot = snapshot == null
                    ? new DungeonEditorControlsViewInputEvent.ProjectionSnapshot("", 0)
                    : snapshot;
            return new ProjectionInput(parseViewMode(safeSnapshot.viewModeKey()), safeSnapshot.levelShift());
        }

        DungeonEditorControlsViewInputEvent.ProjectionSnapshot toLegacySnapshot() {
            return new DungeonEditorControlsViewInputEvent.ProjectionSnapshot(viewModeKey(), levelShift);
        }

        private String viewModeKey() {
            if (viewMode == DungeonEditorViewMode.GRAPH) {
                return "Graph";
            }
            if (viewMode == DungeonEditorViewMode.GRID) {
                return "Grid";
            }
            return "";
        }

        private static DungeonEditorViewMode parseViewMode(String viewModeKey) {
            String normalized = normalizedName(viewModeKey);
            if (normalized.isBlank()) {
                return null;
            }
            return switch (normalized) {
                case "GRAPH" -> DungeonEditorViewMode.GRAPH;
                case "GRID" -> DungeonEditorViewMode.GRID;
                default -> null;
            };
        }
    }

    record OverlayInput(
            DungeonEditorOverlaySettings.Mode mode,
            int levelRange,
            double opacity,
            String selectedLevelsText
    ) {
        OverlayInput {
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevelsText = selectedLevelsText == null ? "" : selectedLevelsText.strip();
        }

        static OverlayInput none() {
            return new OverlayInput(null, 0, 0.0, "");
        }

        static OverlayInput fromLegacy(DungeonEditorControlsViewInputEvent.OverlaySnapshot snapshot) {
            DungeonEditorControlsViewInputEvent.OverlaySnapshot safeSnapshot = snapshot == null
                    ? new DungeonEditorControlsViewInputEvent.OverlaySnapshot("", 0, 0.0, "")
                    : snapshot;
            return new OverlayInput(
                    parseMode(safeSnapshot.modeKey()),
                    safeSnapshot.levelRange(),
                    safeSnapshot.opacity(),
                    safeSnapshot.selectedLevelsText());
        }

        DungeonEditorControlsViewInputEvent.OverlaySnapshot toLegacySnapshot() {
            return new DungeonEditorControlsViewInputEvent.OverlaySnapshot(
                    mode == null ? "" : mode.name(),
                    levelRange,
                    opacity,
                    selectedLevelsText);
        }

        private static DungeonEditorOverlaySettings.Mode parseMode(String modeKey) {
            String normalized = normalizedName(modeKey);
            if (normalized.isBlank()) {
                return null;
            }
            try {
                return DungeonEditorOverlaySettings.Mode.valueOf(normalized);
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }
    }

    private static String normalizedName(String value) {
        return value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
    }
}
