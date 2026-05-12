package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;

public final class DungeonEditorContributionModel {

    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.initial());
    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.initial());
    private static final long NO_MAP_ID = 0L;

    private DungeonEditorSnapshot editorSnapshot = DungeonEditorSnapshot.empty("");
    private LocalState localState = LocalState.initial();
    private InteractionState interactionState = InteractionState.empty();

    public DungeonEditorContributionModel() {
        refreshProjection();
    }

    public ReadOnlyObjectProperty<ControlsProjection> controlsProjectionProperty() {
        return controlsProjection.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<StateProjection> stateProjectionProperty() {
        return stateProjection.getReadOnlyProperty();
    }

    public void apply(DungeonEditorSnapshot editorSnapshot) {
        this.editorSnapshot = editorSnapshot == null ? DungeonEditorSnapshot.empty("") : editorSnapshot;
        refreshProjection();
    }

    void applyLocalMutation(LocalMutation mutation) {
        if (mutation == null) {
            return;
        }
        localState = LocalStateReducer.apply(localState, interactionState, mutation);
        refreshProjection();
    }

    InteractionState currentInteractionState() {
        return interactionState;
    }

    private void refreshProjection() {
        var bundle = ProjectionFactory.create(editorSnapshot, localState);
        localState = bundle.localState();
        interactionState = bundle.interactionState();
        controlsProjection.set(bundle.controlsProjection());
        stateProjection.set(bundle.stateProjection());
    }

    record ControlsProjection(
            List<MapListEntry> mapEntries,
            String selectedMapKey,
            List<Integer> reachableLevels,
            boolean busy,
            String statusText,
            String viewModeLabel,
            OverlayProjection overlayProjection,
            int projectionLevel,
            String selectedToolLabel,
            MapEditorUiState mapEditorUiState,
            ToolPaletteUiState toolPaletteUiState
    ) {
        ControlsProjection {
            mapEntries = mapEntries == null ? List.of() : List.copyOf(mapEntries);
            selectedMapKey = selectedMapKey == null ? "" : selectedMapKey;
            reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
            statusText = statusText == null ? "" : statusText;
            viewModeLabel = ToolCatalog.normalizeViewModeKey(viewModeLabel);
            overlayProjection = overlayProjection == null
                    ? OverlayProjection.from(DungeonEditorOverlaySettings.defaults())
                    : overlayProjection;
            projectionLevel = Math.max(0, projectionLevel);
            selectedToolLabel = selectedToolLabel == null ? ToolCatalog.DEFAULT_TOOL_LABEL : selectedToolLabel;
            mapEditorUiState = mapEditorUiState == null ? MapEditorUiState.hidden() : mapEditorUiState;
            toolPaletteUiState = toolPaletteUiState == null ? ToolPaletteUiState.closed() : toolPaletteUiState;
        }

        static ControlsProjection initial() {
            return new ControlsProjection(
                    List.of(),
                    "",
                    List.of(0),
                    false,
                    "",
                    ToolCatalog.GRID_VIEW_LABEL,
                    OverlayProjection.from(DungeonEditorOverlaySettings.defaults()),
                    0,
                    ToolCatalog.DEFAULT_TOOL_LABEL,
                    MapEditorUiState.hidden(),
                    ToolPaletteUiState.closed());
        }
    }

    record StateProjection(
            String stateText,
            String statusText,
            boolean busy,
            List<RoomNarrationCardProjection> narrationCards
    ) {
        StateProjection {
            stateText = stateText == null ? "" : stateText;
            statusText = statusText == null ? "" : statusText;
            narrationCards = narrationCards == null ? List.of() : List.copyOf(narrationCards);
        }

        static StateProjection initial() {
            return new StateProjection("", "", false, List.of());
        }
    }

    record InteractionState(
            long currentSelectedMapIdValue,
            String currentViewModeKey,
            String currentSelectedToolLabel,
            OverlayProjection currentOverlayProjection,
            MapEditorUiState currentMapEditorUiState,
            List<MapListEntry> mapEntries
    ) {
        InteractionState {
            currentSelectedMapIdValue = Math.max(NO_MAP_ID, currentSelectedMapIdValue);
            currentViewModeKey = ToolCatalog.normalizeViewModeKey(currentViewModeKey);
            currentSelectedToolLabel = currentSelectedToolLabel == null
                    ? ToolCatalog.DEFAULT_TOOL_LABEL
                    : currentSelectedToolLabel;
            currentOverlayProjection = currentOverlayProjection == null
                    ? OverlayProjection.from(DungeonEditorOverlaySettings.defaults())
                    : currentOverlayProjection;
            currentMapEditorUiState = currentMapEditorUiState == null
                    ? MapEditorUiState.hidden()
                    : currentMapEditorUiState;
            mapEntries = mapEntries == null ? List.of() : List.copyOf(mapEntries);
        }

        static InteractionState empty() {
            return new InteractionState(
                    NO_MAP_ID,
                    ToolCatalog.GRID_VIEW_LABEL,
                    ToolCatalog.DEFAULT_TOOL_LABEL,
                    OverlayProjection.from(DungeonEditorOverlaySettings.defaults()),
                    MapEditorUiState.hidden(),
                    List.of());
        }

        @Nullable MapListEntry mapEntry(long mapIdValue) {
            if (mapIdValue <= NO_MAP_ID) {
                return null;
            }
            return mapEntries.stream()
                    .filter(entry -> entry.matchesId(mapIdValue))
                    .findFirst()
                    .orElse(null);
        }
    }

    record MapSelection(
            String key,
            DungeonEditorMapId mapId,
            String mapName,
            long revision
    ) {
        static final String DEFAULT_MAP_NAME = "Dungeon Map";

        MapSelection {
            key = key == null ? "" : key;
            mapName = mapName == null || mapName.isBlank() ? DEFAULT_MAP_NAME : mapName;
            revision = Math.max(0L, revision);
        }

        static String keyOf(@Nullable DungeonEditorMapId mapId) {
            return mapId == null ? "" : Long.toString(mapId.value());
        }
    }

    record MapListEntry(
            String key,
            long mapIdValue,
            String mapName,
            long revision
    ) {
        MapListEntry {
            key = key == null ? "" : key;
            mapIdValue = Math.max(0L, mapIdValue);
            mapName = mapName == null || mapName.isBlank() ? MapSelection.DEFAULT_MAP_NAME : mapName;
            revision = Math.max(0L, revision);
        }

        static MapListEntry from(MapSelection selection) {
            MapSelection safeSelection = selection == null
                    ? new MapSelection("", null, MapSelection.DEFAULT_MAP_NAME, 0L)
                    : selection;
            return new MapListEntry(
                    safeSelection.key(),
                    safeSelection.mapId() == null ? 0L : safeSelection.mapId().value(),
                    safeSelection.mapName(),
                    safeSelection.revision());
        }

        boolean matchesId(long selectedMapIdValue) {
            return mapIdValue == selectedMapIdValue;
        }
    }

    record OverlayProjection(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels,
            String selectedLevelsText
    ) {
        OverlayProjection {
            modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
            selectedLevelsText = selectedLevelsText == null ? "" : selectedLevelsText.strip();
        }

        static OverlayProjection from(DungeonEditorOverlaySettings overlaySettings) {
            DungeonEditorOverlaySettings safeOverlay =
                    overlaySettings == null ? DungeonEditorOverlaySettings.defaults() : overlaySettings;
            List<Integer> selectedLevels = safeOverlay.selectedLevels();
            return new OverlayProjection(
                    safeOverlay.modeKey(),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    selectedLevels,
                    selectedLevels == null || selectedLevels.isEmpty()
                            ? ""
                            : selectedLevels.stream().map(String::valueOf).collect(Collectors.joining(", ")));
        }

        String overlayLabel() {
            return switch (modeKey) {
                case "NEARBY" -> "Nahe Ebenen";
                case "SELECTED" -> "Ausgewählte Ebenen";
                default -> "Overlays aus";
            };
        }
    }

    enum MapEditorMode {
        HIDDEN,
        CREATE,
        RENAME,
        DELETE;

        static MapEditorMode hiddenMode() {
            return HIDDEN;
        }

        boolean isRenameMode() {
            return this == RENAME;
        }

        boolean isDeleteMode() {
            return this == DELETE;
        }
    }

    record MapEditorUiState(
            boolean visible,
            MapEditorMode mode,
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
        MapEditorUiState {
            mode = mode == null ? MapEditorMode.hiddenMode() : mode;
            mapIdValue = Math.max(0L, mapIdValue);
            title = title == null ? "" : title;
            draftName = draftName == null ? "" : draftName.strip();
            errorText = errorText == null ? "" : errorText;
            submitLabel = submitLabel == null ? "" : submitLabel;
        }

        static MapEditorUiState hidden() {
            return new MapEditorUiState(false, MapEditorMode.hiddenMode(), 0L, "", "", "", false, false, false, "", false);
        }

        static MapEditorUiState create(String draftName) {
            return new MapEditorUiState(
                    true,
                    MapEditorMode.CREATE,
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

        static MapEditorUiState rename(long mapIdValue, String draftName) {
            return new MapEditorUiState(
                    true,
                    MapEditorMode.RENAME,
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

        static MapEditorUiState delete(long mapIdValue, String mapName) {
            return new MapEditorUiState(
                    true,
                    MapEditorMode.DELETE,
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

        MapEditorUiState withDraftName(String nextDraftName) {
            return new MapEditorUiState(
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

        MapEditorUiState withErrorText(String nextErrorText) {
            return new MapEditorUiState(
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
            return mode == MapEditorMode.CREATE;
        }

        boolean isRenameMode() {
            return mode == MapEditorMode.RENAME;
        }

        boolean isDeleteMode() {
            return mode == MapEditorMode.DELETE;
        }

        boolean targetsExistingMap() {
            return isRenameMode() || isDeleteMode();
        }
    }

    enum ToolFamily {
        NONE,
        ROOM,
        WALL,
        DOOR,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    record ToolPaletteUiState(
            boolean visible,
            ToolFamily family,
            String primaryToolLabel,
            String secondaryToolLabel
    ) {
        ToolPaletteUiState {
            family = family == null ? ToolFamily.NONE : family;
            primaryToolLabel = primaryToolLabel == null ? "" : primaryToolLabel;
            secondaryToolLabel = secondaryToolLabel == null ? "" : secondaryToolLabel;
        }

        static ToolPaletteUiState closed() {
            return new ToolPaletteUiState(false, ToolFamily.NONE, "", "");
        }

        static ToolPaletteUiState open(ToolFamily family) {
            ToolPalette palette = ToolCatalog.paletteFor(family);
            if (family == null || family == ToolFamily.NONE || !palette.available()) {
                return closed();
            }
            return new ToolPaletteUiState(true, family, palette.primaryToolLabel(), palette.secondaryToolLabel());
        }
    }

    record RoomNarrationCardProjection(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarrationProjection> exits
    ) {
        RoomNarrationCardProjection {
            roomName = roomName == null || roomName.isBlank() ? "Raum" : roomName;
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    record RoomExitNarrationProjection(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        RoomExitNarrationProjection {
            label = label == null || label.isBlank() ? "Ausgang" : label;
            direction = direction == null || direction.isBlank() ? "NORTH" : direction;
            description = description == null ? "" : description;
        }
    }

    record LocalState(
            MapEditorUiState mapEditorUiState,
            ToolPaletteUiState toolPaletteUiState
    ) {
        LocalState {
            mapEditorUiState = mapEditorUiState == null ? MapEditorUiState.hidden() : mapEditorUiState;
            toolPaletteUiState = toolPaletteUiState == null ? ToolPaletteUiState.closed() : toolPaletteUiState;
        }

        static LocalState initial() {
            return new LocalState(MapEditorUiState.hidden(), ToolPaletteUiState.closed());
        }

        LocalState withMapEditorUiState(MapEditorUiState nextMapEditorUiState) {
            return new LocalState(nextMapEditorUiState, toolPaletteUiState);
        }

        LocalState withToolPaletteUiState(ToolPaletteUiState nextToolPaletteUiState) {
            return new LocalState(mapEditorUiState, nextToolPaletteUiState);
        }
    }

    sealed interface LocalMutation permits OpenCreateMapEditorMutation,
            OpenSelectedMapEditorMutation,
            UpdateMapEditorDraftMutation,
            ShowMapEditorValidationErrorMutation,
            CloseMapEditorMutation,
            SetToolPaletteMutation {
    }

    static final class OpenCreateMapEditorMutation implements LocalMutation {
    }

    record OpenSelectedMapEditorMutation(
            MapEditorMode mode,
            long mapIdValue
    ) implements LocalMutation {
        OpenSelectedMapEditorMutation {
            mode = mode == null ? MapEditorMode.hiddenMode() : mode;
            mapIdValue = Math.max(NO_MAP_ID, mapIdValue);
        }
    }

    record UpdateMapEditorDraftMutation(String draftName) implements LocalMutation {
        UpdateMapEditorDraftMutation {
            draftName = draftName == null ? "" : draftName;
        }
    }

    record ShowMapEditorValidationErrorMutation(String errorText) implements LocalMutation {
        ShowMapEditorValidationErrorMutation {
            errorText = errorText == null ? "" : errorText;
        }
    }

    record CloseMapEditorMutation() implements LocalMutation {
    }

    record SetToolPaletteMutation(@Nullable ToolFamily family) implements LocalMutation {
    }

    private static final class LocalStateReducer {

        private static final String DEFAULT_DUNGEON_NAME = "Dungeon";

        static LocalState apply(
                LocalState localState,
                InteractionState interactionState,
                LocalMutation mutation
        ) {
            LocalState safeLocalState = localState == null ? LocalState.initial() : localState;
            InteractionState safeInteractionState =
                    interactionState == null ? InteractionState.empty() : interactionState;
            return switch (mutation) {
                case OpenCreateMapEditorMutation ignored -> safeLocalState.withMapEditorUiState(
                        MapEditorUiState.create(DEFAULT_DUNGEON_NAME));
                case OpenSelectedMapEditorMutation open -> applyOpenSelectedMapEditor(safeLocalState, safeInteractionState, open);
                case UpdateMapEditorDraftMutation update -> applyDraftUpdate(safeLocalState, update);
                case ShowMapEditorValidationErrorMutation validationError -> applyValidationError(safeLocalState, validationError);
                case CloseMapEditorMutation ignored -> safeLocalState.withMapEditorUiState(MapEditorUiState.hidden());
                case SetToolPaletteMutation palette -> safeLocalState.withToolPaletteUiState(
                        palette.family() == null
                                ? ToolPaletteUiState.closed()
                                : ToolPaletteUiState.open(palette.family()));
            };
        }

        private static LocalState applyOpenSelectedMapEditor(
                LocalState localState,
                InteractionState interactionState,
                OpenSelectedMapEditorMutation mutation
        ) {
            MapListEntry mapEntry = interactionState.mapEntry(mutation.mapIdValue());
            if (mapEntry == null) {
                return localState.withMapEditorUiState(MapEditorUiState.hidden());
            }
            if (mutation.mode().isRenameMode()) {
                return localState.withMapEditorUiState(
                        MapEditorUiState.rename(mapEntry.mapIdValue(), mapEntry.mapName()));
            }
            if (mutation.mode().isDeleteMode()) {
                return localState.withMapEditorUiState(
                        MapEditorUiState.delete(mapEntry.mapIdValue(), mapEntry.mapName()));
            }
            return localState;
        }

        private static LocalState applyDraftUpdate(
                LocalState localState,
                UpdateMapEditorDraftMutation mutation
        ) {
            MapEditorUiState currentState = localState.mapEditorUiState();
            if (!currentState.visible()) {
                return localState;
            }
            String safeDraftName = mutation.draftName().strip();
            if (currentState.draftName().equals(safeDraftName) && currentState.errorText().isBlank()) {
                return localState;
            }
            return localState.withMapEditorUiState(currentState.withDraftName(safeDraftName).withErrorText(""));
        }

        private static LocalState applyValidationError(
                LocalState localState,
                ShowMapEditorValidationErrorMutation mutation
        ) {
            MapEditorUiState currentState = localState.mapEditorUiState();
            if (!currentState.visible()) {
                return localState;
            }
            return localState.withMapEditorUiState(currentState.withErrorText(mutation.errorText()));
        }
    }

}
