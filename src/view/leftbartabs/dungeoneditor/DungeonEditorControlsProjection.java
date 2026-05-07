package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;

record DungeonEditorControlsProjection(
        List<DungeonEditorMapListEntry> mapEntries,
        String selectedMapKey,
        List<Integer> reachableLevels,
        boolean busy,
        String statusText,
        String viewModeLabel,
        DungeonEditorOverlayProjection overlayProjection,
        int projectionLevel,
        String selectedToolLabel,
        DungeonEditorMapEditorUiState mapEditorUiState,
        DungeonEditorToolPaletteUiState toolPaletteUiState
) {
    DungeonEditorControlsProjection {
        mapEntries = mapEntries == null ? List.of() : List.copyOf(mapEntries);
        selectedMapKey = selectedMapKey == null ? "" : selectedMapKey;
        reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
        statusText = statusText == null ? "" : statusText;
        viewModeLabel = DungeonEditorToolCatalog.normalizeViewModeKey(viewModeLabel);
        overlayProjection = overlayProjection == null
                ? DungeonEditorOverlayProjection.from(DungeonEditorOverlaySettings.defaults())
                : overlayProjection;
        projectionLevel = Math.max(0, projectionLevel);
        selectedToolLabel = selectedToolLabel == null ? DungeonEditorToolCatalog.DEFAULT_TOOL_LABEL : selectedToolLabel;
        mapEditorUiState = mapEditorUiState == null ? DungeonEditorMapEditorUiState.hidden() : mapEditorUiState;
        toolPaletteUiState = toolPaletteUiState == null ? DungeonEditorToolPaletteUiState.closed() : toolPaletteUiState;
    }

    static DungeonEditorControlsProjection initial() {
        return new DungeonEditorControlsProjection(
                List.of(),
                "",
                List.of(0),
                false,
                "",
                DungeonEditorToolCatalog.GRID_VIEW_LABEL,
                DungeonEditorOverlayProjection.from(DungeonEditorOverlaySettings.defaults()),
                0,
                DungeonEditorToolCatalog.DEFAULT_TOOL_LABEL,
                DungeonEditorMapEditorUiState.hidden(),
                DungeonEditorToolPaletteUiState.closed());
    }
}

record DungeonEditorMapSelection(
        String key,
        DungeonEditorMapId mapId,
        String mapName,
        long revision
) {
    DungeonEditorMapSelection {
        key = key == null ? "" : key;
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
        revision = Math.max(0L, revision);
    }

    static String keyOf(@Nullable DungeonEditorMapId mapId) {
        return mapId == null ? "" : Long.toString(mapId.value());
    }
}

record DungeonEditorMapListEntry(
        String key,
        long mapIdValue,
        String mapName,
        long revision
) {
    DungeonEditorMapListEntry {
        key = key == null ? "" : key;
        mapIdValue = Math.max(0L, mapIdValue);
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
        revision = Math.max(0L, revision);
    }

    static DungeonEditorMapListEntry from(DungeonEditorMapSelection selection) {
        DungeonEditorMapSelection safeSelection = selection == null
                ? new DungeonEditorMapSelection("", null, "Dungeon Map", 0L)
                : selection;
        return new DungeonEditorMapListEntry(
                safeSelection.key(),
                safeSelection.mapId() == null ? 0L : safeSelection.mapId().value(),
                safeSelection.mapName(),
                safeSelection.revision());
    }

    boolean matchesId(long selectedMapIdValue) {
        return mapIdValue == selectedMapIdValue;
    }
}

record DungeonEditorOverlayProjection(
        String modeKey,
        int levelRange,
        double opacity,
        List<Integer> selectedLevels,
        String selectedLevelsText
) {
    DungeonEditorOverlayProjection {
        modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
        levelRange = Math.max(0, levelRange);
        opacity = Math.max(0.0, Math.min(1.0, opacity));
        selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        selectedLevelsText = selectedLevelsText == null ? "" : selectedLevelsText.strip();
    }

    static DungeonEditorOverlayProjection from(DungeonEditorOverlaySettings overlaySettings) {
        DungeonEditorOverlaySettings safeOverlay =
                overlaySettings == null ? DungeonEditorOverlaySettings.defaults() : overlaySettings;
        List<Integer> selectedLevels = safeOverlay.selectedLevels();
        return new DungeonEditorOverlayProjection(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                selectedLevels,
                selectedLevels == null || selectedLevels.isEmpty()
                        ? ""
                        : selectedLevels.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(", ")));
    }

    String overlayLabel() {
        return switch (modeKey) {
            case "NEARBY" -> "Nahe Ebenen";
            case "SELECTED" -> "Ausgewählte Ebenen";
            default -> "Overlays aus";
        };
    }
}

enum DungeonEditorMapEditorMode {
    HIDDEN,
    CREATE,
    RENAME,
    DELETE;

    static DungeonEditorMapEditorMode hiddenMode() {
        return HIDDEN;
    }

    boolean isRenameMode() {
        return this == RENAME;
    }

    boolean isDeleteMode() {
        return this == DELETE;
    }
}

record DungeonEditorMapEditorUiState(
        boolean visible,
        DungeonEditorMapEditorMode mode,
        long mapIdValue,
        String title,
        String draftName,
        String errorText,
        boolean draftFieldVisible,
        boolean actionRowVisible,
        boolean submitVisible,
        String submitLabel,
        boolean deleteConfirmationVisible
) {
    DungeonEditorMapEditorUiState {
        mode = mode == null ? DungeonEditorMapEditorMode.hiddenMode() : mode;
        mapIdValue = Math.max(0L, mapIdValue);
        title = title == null ? "" : title;
        draftName = draftName == null ? "" : draftName.strip();
        errorText = errorText == null ? "" : errorText;
        submitLabel = submitLabel == null ? "" : submitLabel;
    }

    static DungeonEditorMapEditorUiState hidden() {
        return new DungeonEditorMapEditorUiState(false, DungeonEditorMapEditorMode.HIDDEN, 0L, "", "", "", false, false, false, "", false);
    }

    static DungeonEditorMapEditorUiState create(String draftName) {
        return new DungeonEditorMapEditorUiState(
                true,
                DungeonEditorMapEditorMode.CREATE,
                0L,
                "Neuen Dungeon anlegen",
                draftName,
                "",
                true,
                true,
                true,
                "Erstellen",
                false);
    }

    static DungeonEditorMapEditorUiState rename(long mapIdValue, String draftName) {
        return new DungeonEditorMapEditorUiState(
                true,
                DungeonEditorMapEditorMode.RENAME,
                mapIdValue,
                "Dungeon bearbeiten",
                draftName,
                "",
                true,
                true,
                true,
                "Speichern",
                false);
    }

    static DungeonEditorMapEditorUiState delete(long mapIdValue, String mapName) {
        return new DungeonEditorMapEditorUiState(
                true,
                DungeonEditorMapEditorMode.DELETE,
                mapIdValue,
                "Dungeon löschen: " + (mapName == null ? "" : mapName),
                "",
                "",
                false,
                false,
                false,
                "",
                true);
    }

    DungeonEditorMapEditorUiState withDraftName(String nextDraftName) {
        return new DungeonEditorMapEditorUiState(
                visible,
                mode,
                mapIdValue,
                title,
                nextDraftName,
                errorText,
                draftFieldVisible,
                actionRowVisible,
                submitVisible,
                submitLabel,
                deleteConfirmationVisible);
    }

    DungeonEditorMapEditorUiState withErrorText(String nextErrorText) {
        return new DungeonEditorMapEditorUiState(
                visible,
                mode,
                mapIdValue,
                title,
                draftName,
                nextErrorText,
                draftFieldVisible,
                actionRowVisible,
                submitVisible,
                submitLabel,
                deleteConfirmationVisible);
    }

    boolean isCreateMode() {
        return mode == DungeonEditorMapEditorMode.CREATE;
    }

    boolean isRenameMode() {
        return mode == DungeonEditorMapEditorMode.RENAME;
    }

    boolean isDeleteMode() {
        return mode == DungeonEditorMapEditorMode.DELETE;
    }

    boolean targetsExistingMap() {
        return isRenameMode() || isDeleteMode();
    }
}

enum DungeonEditorToolFamily {
    NONE,
    ROOM,
    WALL,
    DOOR,
    CORRIDOR,
    STAIR,
    TRANSITION
}

record DungeonEditorToolPaletteUiState(
        boolean visible,
        DungeonEditorToolFamily family,
        String primaryToolLabel,
        String secondaryToolLabel
) {
    DungeonEditorToolPaletteUiState {
        family = family == null ? DungeonEditorToolFamily.NONE : family;
        primaryToolLabel = primaryToolLabel == null ? "" : primaryToolLabel;
        secondaryToolLabel = secondaryToolLabel == null ? "" : secondaryToolLabel;
    }

    static DungeonEditorToolPaletteUiState closed() {
        return new DungeonEditorToolPaletteUiState(false, DungeonEditorToolFamily.NONE, "", "");
    }

    static DungeonEditorToolPaletteUiState open(DungeonEditorToolFamily family) {
        DungeonEditorToolPalette palette = DungeonEditorToolCatalog.paletteFor(family);
        if (family == null || family == DungeonEditorToolFamily.NONE || !palette.available()) {
            return closed();
        }
        return new DungeonEditorToolPaletteUiState(true, family, palette.primaryToolLabel(), palette.secondaryToolLabel());
    }
}
