package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorCell;
import src.domain.dungeoneditor.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.DungeonEditorMapSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapSummary;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorPreview;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorSurface;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;

public final class DungeonEditorContributionModel {

    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.initial());
    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.initial());
    private ProjectionSource projectionSource = ProjectionSource.empty();
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
        projectionSource = ProjectionSource.from(editorSnapshot);
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
        ProjectionBundle bundle = ProjectionFactory.create(projectionSource, localState);
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
            @Nullable MapListEntry currentSelectedMapEntry,
            String currentViewModeKey,
            String currentSelectedToolLabel,
            OverlayProjection currentOverlayProjection,
            MapEditorUiState currentMapEditorUiState,
            List<MapListEntry> mapEntries
    ) {
        InteractionState {
            currentSelectedMapIdValue = Math.max(LocalIds.NO_MAP_ID, currentSelectedMapIdValue);
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
                    LocalIds.NO_MAP_ID,
                    null,
                    ToolCatalog.GRID_VIEW_LABEL,
                    ToolCatalog.DEFAULT_TOOL_LABEL,
                    OverlayProjection.from(DungeonEditorOverlaySettings.defaults()),
                    MapEditorUiState.hidden(),
                    List.of());
        }

        @Nullable MapListEntry mapEntry(long mapIdValue) {
            if (mapIdValue <= LocalIds.NO_MAP_ID) {
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
            mapIdValue = Math.max(LocalIds.NO_MAP_ID, mapIdValue);
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

    private static final class ProjectionFactory {

        private static final String NO_MAPS_STATUS = "Keine Dungeon-Maps vorhanden.";
        private static final String NO_SELECTED_MAP_STATUS = "Kein Dungeon ausgewählt.";

        static ProjectionBundle create(
                ProjectionSource source,
                LocalState localState
        ) {
            ProjectionSource safeSource = source == null ? ProjectionSource.empty() : source;
            LocalState safeLocalState = localState == null ? LocalState.initial() : localState;
            List<MapListEntry> mapEntries = safeSource.maps().stream().map(MapListEntry::from).toList();
            List<Integer> reachableLevels = SurfaceLevels.from(safeSource.surface(), safeSource.projectionLevel());
            int clampedProjectionLevel = clampProjectionLevel(reachableLevels, safeSource.projectionLevel());
            OverlayProjection overlayProjection = OverlayProjection.from(safeSource.overlaySettings());
            String selectedMapKey = MapSelection.keyOf(safeSource.selectedMapId());
            String viewModeLabel = ToolCatalog.labelOf(safeSource.viewMode());
            String selectedToolLabel = ToolCatalog.labelOf(safeSource.selectedTool());
            String statusText = statusTextFor(safeSource, mapEntries);
            MapEditorUiState mapEditorUiState =
                    synchronizeMapEditorUiState(safeLocalState.mapEditorUiState(), mapEntries);
            List<RoomNarrationCardProjection> narrationCards =
                    ProjectionTextSupport.toNarrationCards(safeSource.inspector());
            ControlsProjection controlsProjection = new ControlsProjection(
                    mapEntries,
                    selectedMapKey,
                    reachableLevels,
                    false,
                    statusText,
                    viewModeLabel,
                    overlayProjection,
                    clampedProjectionLevel,
                    selectedToolLabel,
                    mapEditorUiState,
                    safeLocalState.toolPaletteUiState());
            StateProjection stateProjection = new StateProjection(
                    ProjectionTextSupport.stateTextFor(
                            safeSource,
                            overlayProjection,
                            selectedToolLabel,
                            viewModeLabel,
                            clampedProjectionLevel),
                    statusText,
                    false,
                    narrationCards);
            long selectedMapIdValue = safeSource.selectedMapId() == null ? LocalIds.NO_MAP_ID : safeSource.selectedMapId().value();
            return new ProjectionBundle(
                    controlsProjection,
                    stateProjection,
                    new InteractionState(
                            selectedMapIdValue,
                            findMapEntry(mapEntries, selectedMapIdValue),
                            viewModeLabel,
                            selectedToolLabel,
                            overlayProjection,
                            mapEditorUiState,
                            mapEntries),
                    new LocalState(mapEditorUiState, safeLocalState.toolPaletteUiState()));
        }

        private static int clampProjectionLevel(List<Integer> reachableLevels, int projectionLevel) {
            if (reachableLevels == null || reachableLevels.isEmpty()) {
                return Math.max(0, projectionLevel);
            }
            return Math.max(reachableLevels.getFirst(), Math.min(reachableLevels.getLast(), projectionLevel));
        }

        private static String statusTextFor(
                ProjectionSource source,
                List<MapListEntry> mapEntries
        ) {
            if (source.surface() != null) {
                return source.statusText();
            }
            if (mapEntries.isEmpty()) {
                return NO_MAPS_STATUS;
            }
            if (source.selectedMapId() == null) {
                return NO_SELECTED_MAP_STATUS;
            }
            return source.statusText();
        }

        private static MapEditorUiState synchronizeMapEditorUiState(
                MapEditorUiState mapEditorUiState,
                List<MapListEntry> mapEntries
        ) {
            MapEditorUiState safeState =
                    mapEditorUiState == null ? MapEditorUiState.hidden() : mapEditorUiState;
            if (!safeState.visible() || !safeState.targetsExistingMap()) {
                return safeState;
            }
            return findMapEntry(mapEntries, safeState.mapIdValue()) == null
                    ? MapEditorUiState.hidden()
                    : safeState;
        }

        private static @Nullable MapListEntry findMapEntry(
                List<MapListEntry> mapEntries,
                long mapIdValue
        ) {
            return mapIdValue <= LocalIds.NO_MAP_ID
                    ? null
                    : mapEntries.stream().filter(entry -> entry.matchesId(mapIdValue)).findFirst().orElse(null);
        }
    }

    private record ProjectionBundle(
            ControlsProjection controlsProjection,
            StateProjection stateProjection,
            InteractionState interactionState,
            LocalState localState
    ) {
    }

    private record ProjectionSource(
            List<MapSelection> maps,
            @Nullable DungeonEditorMapId selectedMapId,
            @Nullable DungeonEditorSurface surface,
            @Nullable DungeonEditorInspectorSnapshot inspector,
            SelectionData selection,
            DungeonEditorPreview preview,
            String statusText,
            DungeonEditorViewMode viewMode,
            DungeonEditorTool selectedTool,
            DungeonEditorOverlaySettings overlaySettings,
            int projectionLevel
    ) {
        ProjectionSource {
            maps = maps == null ? List.of() : List.copyOf(maps);
            inspector = inspector == null && surface != null ? surface.inspector() : inspector;
            selection = selection == null ? SelectionData.empty() : selection;
            preview = preview == null ? DungeonEditorPreview.none() : preview;
            statusText = statusText == null ? "" : statusText;
            viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
            selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
            overlaySettings = overlaySettings == null ? DungeonEditorOverlaySettings.defaults() : overlaySettings;
            projectionLevel = Math.max(0, projectionLevel);
        }

        static ProjectionSource from(@Nullable DungeonEditorSnapshot snapshot) {
            DungeonEditorSnapshot safeSnapshot = snapshot == null ? DungeonEditorSnapshot.empty("") : snapshot;
            DungeonEditorSurface surface = safeSnapshot.surface();
            return new ProjectionSource(
                    safeSnapshot.maps().stream().map(ProjectionSource::toMapSelection).toList(),
                    safeSnapshot.selectedMapId(),
                    surface,
                    surface == null ? null : surface.inspector(),
                    SelectionData.from(safeSnapshot.selection()),
                    safeSnapshot.preview(),
                    safeSnapshot.statusText(),
                    safeSnapshot.viewMode(),
                    safeSnapshot.selectedTool(),
                    safeSnapshot.overlaySettings(),
                    safeSnapshot.projectionLevel());
        }

        static ProjectionSource empty() {
            return from(DungeonEditorSnapshot.empty(""));
        }

        private static MapSelection toMapSelection(@Nullable DungeonEditorMapSummary summary) {
            DungeonEditorMapSummary safeSummary = summary == null
                    ? new DungeonEditorMapSummary(new DungeonEditorMapId(1L), MapSelection.DEFAULT_MAP_NAME, 0L)
                    : summary;
            return new MapSelection(
                    MapSelection.keyOf(safeSummary.mapId()),
                    safeSummary.mapId(),
                    safeSummary.mapName(),
                    safeSummary.revision());
        }

        private record SelectionData(String kind, long id) {
            SelectionData {
                kind = kind == null ? "EMPTY" : kind;
                id = Math.max(0L, id);
            }

            static SelectionData empty() {
                return new SelectionData("EMPTY", 0L);
            }

            static SelectionData from(DungeonEditorSnapshot.Selection selection) {
                DungeonEditorSnapshot.Selection safeSelection = selection == null
                        ? DungeonEditorSnapshot.Selection.empty()
                        : selection;
                return new SelectionData(safeSelection.topologyRef().kind(), safeSelection.topologyRef().id());
            }

            boolean isEmpty() {
                return "EMPTY".equals(kind);
            }
        }
    }

    private static final class ProjectionTextSupport {

        static String stateTextFor(
                ProjectionSource source,
                OverlayProjection overlayProjection,
                String selectedToolLabel,
                String viewModeLabel,
                int projectionLevel
        ) {
            return "Werkzeug: " + selectedToolLabel
                    + "\nAnsicht: " + viewModeLabel
                    + "\nEbene: z=" + projectionLevel
                    + "\n" + overlayProjection.overlayLabel()
                    + "\n" + selectionTextFor(source.selection(), source.inspector())
                    + "\n" + previewTextFor(source.preview());
        }

        static List<RoomNarrationCardProjection> toNarrationCards(
                @Nullable DungeonEditorInspectorSnapshot inspector
        ) {
            if (inspector == null) {
                return List.of();
            }
            return inspector.roomNarrations().stream()
                    .map(card -> new RoomNarrationCardProjection(
                            card.roomId(),
                            card.roomName(),
                            card.visualDescription(),
                            card.exits().stream()
                                    .map(exit -> new RoomExitNarrationProjection(
                                            exit.label(),
                                            exit.cell().q(),
                                            exit.cell().r(),
                                            exit.cell().level(),
                                            exit.direction(),
                                            exit.description()))
                                    .toList()))
                    .toList();
        }

        private static String selectionTextFor(
                ProjectionSource.SelectionData selection,
                @Nullable DungeonEditorInspectorSnapshot inspector
        ) {
            if (selection.isEmpty()) {
                return "Auswahl: Keine";
            }
            String selectionLabel = inspector != null && !inspector.title().isBlank()
                    ? inspector.title()
                    : selection.kind();
            return "Auswahl: " + selectionLabel + " (" + selection.kind() + " " + selection.id() + ")";
        }

        private static String previewTextFor(DungeonEditorPreview preview) {
            if (preview == null || preview instanceof DungeonEditorPreview.NonePreview) {
                return "Topologie-Preview: inaktiv";
            }
            if (preview instanceof DungeonEditorPreview.MoveHandlePreview movePreview) {
                return "Topologie-Preview: verschieben dq=" + movePreview.deltaQ()
                        + ", dr=" + movePreview.deltaR()
                        + ", dz=" + movePreview.deltaLevel();
            }
            if (preview instanceof DungeonEditorPreview.RoomRectanglePreview roomRectangle) {
                return "Topologie-Preview: "
                        + (roomRectangle.deleteMode() ? ToolCatalog.ROOM_DELETE_LABEL : ToolCatalog.ROOM_PAINT_LABEL)
                        + " z=" + roomRectangle.start().level();
            }
            if (preview instanceof DungeonEditorPreview.ClusterBoundariesPreview boundaries) {
                return "Topologie-Preview: "
                        + (boundaries.deleteMode() ? "Kanten löschen" : "Kanten setzen")
                        + " (" + boundaries.edges().size() + ")";
            }
            if (preview instanceof DungeonEditorPreview.MoveBoundaryStretchPreview stretch) {
                return "Topologie-Preview: Wandstrecke verschieben dq=" + stretch.deltaQ()
                        + ", dr=" + stretch.deltaR()
                        + ", dz=" + stretch.deltaLevel()
                        + " (" + stretch.sourceEdges().size() + ")";
            }
            return "Topologie-Preview: aktiv";
        }
    }

    private static final class SurfaceLevels {

        static List<Integer> from(@Nullable DungeonEditorSurface surface, int fallbackLevel) {
            SortedSet<Integer> levels = new TreeSet<>();
            if (surface != null && surface.map() != null) {
                surface.map().areas().forEach(area -> addCellLevels(levels, area.cells()));
                for (DungeonEditorMapSnapshot.Feature feature : surface.map().features()) {
                    addCellLevels(levels, feature.cells());
                }
                surface.map().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
                if (surface.previewMap() != null) {
                    surface.previewMap().areas().forEach(area -> addCellLevels(levels, area.cells()));
                    for (DungeonEditorMapSnapshot.Feature feature : surface.previewMap().features()) {
                        addCellLevels(levels, feature.cells());
                    }
                    surface.previewMap().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
                }
            }
            if (levels.isEmpty()) {
                levels.add(fallbackLevel);
            }
            return new ArrayList<>(levels);
        }

        private static void addCellLevels(SortedSet<Integer> levels, List<DungeonEditorCell> cells) {
            for (DungeonEditorCell cell : cells == null ? List.<DungeonEditorCell>of() : cells) {
                levels.add(cell.level());
            }
        }
    }

    static final class ToolCatalog {

        static final String DEFAULT_TOOL_LABEL = "Auswahl";
        static final String GRID_VIEW_LABEL = "Grid";
        static final String GRAPH_VIEW_LABEL = "Graph";
        static final String ROOM_PAINT_LABEL = "Raum malen";
        static final String ROOM_DELETE_LABEL = "Raum löschen";
        private static final Map<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();
        private static final Map<String, DungeonEditorSessionValues.Tool> SESSION_TOOLS_BY_LABEL =
                createSessionToolsByLabel();
        private static final Map<ToolFamily, ToolPalette> PALETTES = createPalettes();

        static String labelOf(@Nullable DungeonEditorTool tool) {
            return TOOL_LABELS.getOrDefault(tool == null ? DungeonEditorTool.SELECT : tool, DEFAULT_TOOL_LABEL);
        }

        static String labelOf(@Nullable DungeonEditorViewMode viewMode) {
            return viewMode == DungeonEditorViewMode.GRAPH ? GRAPH_VIEW_LABEL : GRID_VIEW_LABEL;
        }

        static String normalizeViewModeKey(@Nullable String viewModeKey) {
            return GRAPH_VIEW_LABEL.equals(viewModeKey) ? GRAPH_VIEW_LABEL : GRID_VIEW_LABEL;
        }

        static DungeonEditorSessionValues.ViewMode toSessionViewMode(@Nullable String viewModeKey) {
            return GRAPH_VIEW_LABEL.equals(viewModeKey)
                    ? DungeonEditorSessionValues.ViewMode.GRAPH
                    : DungeonEditorSessionValues.ViewMode.GRID;
        }

        static DungeonEditorSessionValues.Tool toSessionTool(@Nullable String selectedToolLabel) {
            return SESSION_TOOLS_BY_LABEL.getOrDefault(selectedToolLabel, DungeonEditorSessionValues.Tool.SELECT);
        }

        static ToolPalette paletteFor(@Nullable ToolFamily family) {
            return family == null ? ToolPalette.empty() : PALETTES.getOrDefault(family, ToolPalette.empty());
        }

        private static Map<DungeonEditorTool, String> createToolLabels() {
            Map<DungeonEditorTool, String> toolLabels = new EnumMap<>(DungeonEditorTool.class);
            toolLabels.put(DungeonEditorTool.SELECT, DEFAULT_TOOL_LABEL);
            toolLabels.put(DungeonEditorTool.ROOM_PAINT, ROOM_PAINT_LABEL);
            toolLabels.put(DungeonEditorTool.ROOM_DELETE, ROOM_DELETE_LABEL);
            toolLabels.put(DungeonEditorTool.WALL_CREATE, "Wand setzen");
            toolLabels.put(DungeonEditorTool.WALL_DELETE, "Wand löschen");
            toolLabels.put(DungeonEditorTool.DOOR_CREATE, "Tür setzen");
            toolLabels.put(DungeonEditorTool.DOOR_DELETE, "Tür löschen");
            toolLabels.put(DungeonEditorTool.CORRIDOR_CREATE, "Korridor erstellen");
            toolLabels.put(DungeonEditorTool.CORRIDOR_DELETE, "Korridor löschen");
            toolLabels.put(DungeonEditorTool.STAIR_CREATE, "Treppe erstellen");
            toolLabels.put(DungeonEditorTool.STAIR_DELETE, "Treppe löschen");
            toolLabels.put(DungeonEditorTool.TRANSITION_CREATE, "Übergang erstellen");
            toolLabels.put(DungeonEditorTool.TRANSITION_DELETE, "Übergang löschen");
            return Map.copyOf(toolLabels);
        }

        private static Map<String, DungeonEditorSessionValues.Tool> createSessionToolsByLabel() {
            Map<String, DungeonEditorSessionValues.Tool> toolsByLabel = new HashMap<>();
            toolsByLabel.put(DEFAULT_TOOL_LABEL, DungeonEditorSessionValues.Tool.SELECT);
            toolsByLabel.put(ROOM_PAINT_LABEL, DungeonEditorSessionValues.Tool.ROOM_PAINT);
            toolsByLabel.put(ROOM_DELETE_LABEL, DungeonEditorSessionValues.Tool.ROOM_DELETE);
            toolsByLabel.put("Wand setzen", DungeonEditorSessionValues.Tool.WALL_CREATE);
            toolsByLabel.put("Wand löschen", DungeonEditorSessionValues.Tool.WALL_DELETE);
            toolsByLabel.put("Tür setzen", DungeonEditorSessionValues.Tool.DOOR_CREATE);
            toolsByLabel.put("Tür löschen", DungeonEditorSessionValues.Tool.DOOR_DELETE);
            toolsByLabel.put("Korridor erstellen", DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
            toolsByLabel.put("Korridor löschen", DungeonEditorSessionValues.Tool.CORRIDOR_DELETE);
            toolsByLabel.put("Treppe erstellen", DungeonEditorSessionValues.Tool.STAIR_CREATE);
            toolsByLabel.put("Treppe löschen", DungeonEditorSessionValues.Tool.STAIR_DELETE);
            toolsByLabel.put("Übergang erstellen", DungeonEditorSessionValues.Tool.TRANSITION_CREATE);
            toolsByLabel.put("Übergang löschen", DungeonEditorSessionValues.Tool.TRANSITION_DELETE);
            return Map.copyOf(toolsByLabel);
        }

        private static Map<ToolFamily, ToolPalette> createPalettes() {
            Map<ToolFamily, ToolPalette> palettes = new EnumMap<>(ToolFamily.class);
            palettes.put(ToolFamily.ROOM, new ToolPalette(ROOM_PAINT_LABEL, ROOM_DELETE_LABEL));
            palettes.put(ToolFamily.WALL, new ToolPalette("Wand setzen", "Wand löschen"));
            palettes.put(ToolFamily.DOOR, new ToolPalette("Tür setzen", "Tür löschen"));
            palettes.put(ToolFamily.CORRIDOR, new ToolPalette("Korridor erstellen", "Korridor löschen"));
            palettes.put(ToolFamily.STAIR, new ToolPalette("Treppe erstellen", "Treppe löschen"));
            palettes.put(ToolFamily.TRANSITION, new ToolPalette("Übergang erstellen", "Übergang löschen"));
            return Map.copyOf(palettes);
        }
    }

    private record ToolPalette(
            String primaryToolLabel,
            String secondaryToolLabel
    ) {
        ToolPalette {
            primaryToolLabel = primaryToolLabel == null ? "" : primaryToolLabel;
            secondaryToolLabel = secondaryToolLabel == null ? "" : secondaryToolLabel;
        }

        static ToolPalette empty() {
            return new ToolPalette("", "");
        }

        boolean available() {
            return !primaryToolLabel.isBlank() && !secondaryToolLabel.isBlank();
        }
    }

    private static final class LocalIds {
        private static final long NO_MAP_ID = 0L;
    }
}
