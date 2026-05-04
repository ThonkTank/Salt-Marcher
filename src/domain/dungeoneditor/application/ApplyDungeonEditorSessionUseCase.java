package src.domain.dungeoneditor.application;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.ApplyDungeonEditorOperationCommand;
import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.CreateDungeonMapResult;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonMapResult;
import src.domain.dungeon.published.DescribeDungeonSelectionQuery;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.LoadDungeonSnapshotQuery;
import src.domain.dungeon.published.PreviewDungeonEditorOperationQuery;
import src.domain.dungeon.published.RenameDungeonMapCommand;
import src.domain.dungeon.published.RenameDungeonMapResult;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.published.SearchMapsResult;

public final class ApplyDungeonEditorSessionUseCase {

    private static final String DEFAULT_VIEW_MODE = "GRID";
    private static final String DEFAULT_TOOL = "Auswahl";

    private final Function<CreateDungeonMapCommand, CreateDungeonMapResult> createMap;
    private final Function<RenameDungeonMapCommand, RenameDungeonMapResult> renameMap;
    private final Function<DeleteDungeonMapCommand, DeleteDungeonMapResult> deleteMap;
    private final Function<ApplyDungeonEditorOperationCommand, DungeonOperationResult> applyOperation;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
            new InterpretDungeonEditorMainViewInputUseCase();

    private @Nullable DungeonMapId selectedMapId;
    private String viewModeKey = DEFAULT_VIEW_MODE;
    private String selectedTool = DEFAULT_TOOL;
    private int projectionLevel;
    private OverlayData overlaySettings = OverlayData.defaults();
    private SelectionData selection = SelectionData.empty();
    private @Nullable DungeonEditorOperation previewOperation;
    private String statusText = "";

    public ApplyDungeonEditorSessionUseCase(
            Function<CreateDungeonMapCommand, CreateDungeonMapResult> createMap,
            Function<RenameDungeonMapCommand, RenameDungeonMapResult> renameMap,
            Function<DeleteDungeonMapCommand, DeleteDungeonMapResult> deleteMap,
            Function<ApplyDungeonEditorOperationCommand, DungeonOperationResult> applyOperation,
            Function<SearchMapsQuery, SearchMapsResult> searchMaps,
            Function<PreviewDungeonEditorOperationQuery, DungeonOperationResult> previewOperation,
            Function<DescribeDungeonSelectionQuery, DungeonInspectorSnapshot> describeSelection,
            Function<LoadDungeonSnapshotQuery, DungeonSnapshot> loadSnapshot
    ) {
        this.createMap = createMap;
        this.renameMap = renameMap;
        this.deleteMap = deleteMap;
        this.applyOperation = applyOperation;
        this.snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(
                searchMaps,
                previewOperation,
                describeSelection,
                loadSnapshot);
    }

    public void primeSelectedMap(@Nullable DungeonMapId mapId) {
        if (selectedMapId == null && mapId != null) {
            selectedMapId = mapId;
        }
    }

    public void apply(@Nullable Command command) {
        if (command == null) {
            return;
        }
        switch (command.action()) {
            case SELECT_MAP -> selectMap(command);
            case CREATE_MAP -> createSelectedMap(command);
            case RENAME_MAP -> renameSelectedMap(command);
            case DELETE_MAP -> deleteSelectedMap(command);
            case SET_VIEW_MODE -> setViewMode(command);
            case SET_TOOL -> setTool(command);
            case SHIFT_PROJECTION_LEVEL -> shiftProjectionLevel(command);
            case SET_OVERLAY -> setOverlay(command);
            case INTERPRET_MAIN_VIEW -> applyMainViewInput(command.mainViewInput());
            case SAVE_ROOM_NARRATION -> applyRoomNarration(command.roomNarration());
        }
    }

    public SnapshotData snapshot() {
        SnapshotData snapshot = snapshotBuilder.execute(new BuildDungeonEditorSnapshotUseCase.State(
                selectedMapId,
                viewModeKey,
                selectedTool,
                projectionLevel,
                overlaySettings,
                selection,
                previewOperation,
                statusText));
        selectedMapId = snapshot.selectedMapId();
        projectionLevel = snapshot.projectionLevel();
        return snapshot;
    }

    private void clearTransientState(String nextStatusText) {
        previewOperation = null;
        statusText = nextStatusText == null ? "" : nextStatusText;
        mainViewInterpreter.clear();
    }

    private void selectMap(Command command) {
        selectedMapId = command.mapId();
        selection = SelectionData.empty();
        clearTransientState("");
    }

    private void createSelectedMap(Command command) {
        selectedMapId = createMap.apply(new CreateDungeonMapCommand(command.mapName())).mapId();
        selection = SelectionData.empty();
        clearTransientState("Dungeon-Map erstellt.");
    }

    private void renameSelectedMap(Command command) {
        selectedMapId = renameMap.apply(new RenameDungeonMapCommand(
                requireMapId(command.mapId()),
                command.mapName())).mapId();
        statusText = "Dungeon-Map umbenannt.";
    }

    private void deleteSelectedMap(Command command) {
        DungeonMapId deletedMapId = deleteMap.apply(new DeleteDungeonMapCommand(requireMapId(command.mapId()))).mapId();
        if (deletedMapId != null && deletedMapId.equals(selectedMapId)) {
            selectedMapId = null;
        }
        selection = SelectionData.empty();
        clearTransientState("Dungeon-Map gelöscht.");
    }

    private void setViewMode(Command command) {
        viewModeKey = normalizeViewMode(command.viewModeKey());
        clearTransientState("");
    }

    private void setTool(Command command) {
        selectedTool = normalizeTool(command.selectedTool());
        clearTransientState("");
    }

    private void shiftProjectionLevel(Command command) {
        projectionLevel += command.projectionLevelDelta();
        statusText = "";
    }

    private void setOverlay(Command command) {
        overlaySettings = command.overlaySettings();
        statusText = "";
    }

    private void applyRoomNarration(RoomNarrationInput roomNarration) {
        if (roomNarration == null || roomNarration.roomId() <= 0L) {
            return;
        }
        DungeonOperationResult result = applyOperation.apply(new ApplyDungeonEditorOperationCommand(
                requireMapId(selectedMapId),
                new DungeonEditorOperation.SaveRoomNarration(
                        roomNarration.roomId(),
                        roomNarration.visualDescription(),
                        roomNarration.exits())));
        previewOperation = null;
        statusText = statusFromMessages(result);
    }

    private void applyMainViewInput(MainViewInput mainViewInput) {
        MainViewInput input = mainViewInput == null ? MainViewInput.empty() : mainViewInput;
        DungeonSnapshot committedSnapshot = snapshotBuilder.loadCommittedSnapshot(selectedMapId);
        if (input.source() == MainViewInputSource.LEVEL_SCROLLED) {
            applyInteractionEffect(mainViewInterpreter.consume(
                    input,
                    committedSnapshot,
                    selection,
                    selectedTool,
                    viewModeKey,
                    projectionLevel));
            return;
        }
        if (selectedMapId == null || committedSnapshot == null || !"GRID".equalsIgnoreCase(viewModeKey)) {
            return;
        }
        applyInteractionEffect(mainViewInterpreter.consume(
                input,
                committedSnapshot,
                selection,
                selectedTool,
                viewModeKey,
                projectionLevel));
    }

    private void applyInteractionEffect(InterpretDungeonEditorMainViewInputUseCase.Effect effect) {
        if (effect == null) {
            return;
        }
        if (effect.projectionLevelDelta() != 0) {
            projectionLevel += effect.projectionLevelDelta();
        }
        if (effect.statusText() != null) {
            statusText = effect.statusText();
        }
        if (effect.clearSelection()) {
            selection = SelectionData.empty();
            previewOperation = null;
        } else if (effect.selection() != null) {
            selection = effect.selection();
            previewOperation = null;
        }
        if (effect.clearPreview()) {
            previewOperation = null;
        } else if (effect.previewOperation() != null) {
            previewOperation = effect.previewOperation();
            statusText = "";
        }
        if (effect.applyOperation() != null) {
            DungeonOperationResult result = applyOperation.apply(new ApplyDungeonEditorOperationCommand(
                    requireMapId(selectedMapId),
                    effect.applyOperation()));
            previewOperation = null;
            statusText = statusFromMessages(result);
        }
    }

    private static String normalizeViewMode(String nextViewModeKey) {
        return "GRAPH".equalsIgnoreCase(nextViewModeKey) ? "GRAPH" : "GRID";
    }

    private static String normalizeTool(String nextSelectedTool) {
        return nextSelectedTool == null || nextSelectedTool.isBlank() ? DEFAULT_TOOL : nextSelectedTool;
    }

    private static DungeonMapId requireMapId(@Nullable DungeonMapId mapId) {
        if (mapId == null) {
            throw new IllegalArgumentException("Dungeon-Map-ID fehlt.");
        }
        return mapId;
    }

    private static String statusFromMessages(@Nullable DungeonOperationResult result) {
        if (result == null) {
            return "";
        }
        if (!result.reactionMessages().isEmpty()) {
            return result.reactionMessages().getFirst();
        }
        if (!result.validationMessages().isEmpty()) {
            return result.validationMessages().getFirst();
        }
        return "";
    }

    public enum Action {
        SELECT_MAP,
        CREATE_MAP,
        RENAME_MAP,
        DELETE_MAP,
        SET_VIEW_MODE,
        SET_TOOL,
        SHIFT_PROJECTION_LEVEL,
        SET_OVERLAY,
        INTERPRET_MAIN_VIEW,
        SAVE_ROOM_NARRATION
    }

    public enum MainViewInputSource {
        POINTER_PRESSED,
        POINTER_DRAGGED,
        POINTER_RELEASED,
        POINTER_MOVED,
        LEVEL_SCROLLED
    }

    public record OverlayData(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {
        public OverlayData {
            modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        public static OverlayData defaults() {
            return new OverlayData("OFF", 2, 0.35, List.of());
        }
    }

    public record SelectionData(
            DungeonTopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection,
            @Nullable DungeonEditorHandleRef handleRef
    ) {
        public SelectionData {
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
        }

        public static SelectionData empty() {
            return new SelectionData(DungeonTopologyElementRef.empty(), 0L, false, null);
        }
    }

    public sealed interface PreviewData permits NonePreviewData,
            RoomRectanglePreviewData,
            ClusterBoundariesPreviewData,
            MoveHandlePreviewData,
            MoveBoundaryStretchPreviewData {
        static PreviewData none() {
            return NonePreviewData.INSTANCE;
        }
    }

    public enum NonePreviewData implements PreviewData {
        INSTANCE
    }

    public record RoomRectanglePreviewData(
            DungeonCellRef start,
            DungeonCellRef end,
            boolean deleteMode
    ) implements PreviewData {
        public RoomRectanglePreviewData {
            start = start == null ? new DungeonCellRef(0, 0, 0) : start;
            end = end == null ? new DungeonCellRef(0, 0, 0) : end;
        }
    }

    public record ClusterBoundariesPreviewData(
            long clusterId,
            List<DungeonEdgeRef> edges,
            DungeonBoundaryKind boundaryKind,
            boolean deleteMode
    ) implements PreviewData {
        public ClusterBoundariesPreviewData {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? List.of() : List.copyOf(edges);
            boundaryKind = boundaryKind == null ? DungeonBoundaryKind.WALL : boundaryKind;
        }
    }

    public record MoveHandlePreviewData(
            DungeonEditorHandleRef handleRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements PreviewData {
        public MoveHandlePreviewData {
            handleRef = handleRef == null
                    ? new DungeonEditorHandleRef(
                    DungeonEditorHandleKind.CLUSTER_LABEL,
                    DungeonTopologyElementRef.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    new DungeonCellRef(0, 0, 0),
                    "")
                    : handleRef;
        }
    }

    public record MoveBoundaryStretchPreviewData(
            long clusterId,
            List<DungeonEdgeRef> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements PreviewData {
        public MoveBoundaryStretchPreviewData {
            clusterId = Math.max(0L, clusterId);
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        }
    }

    public record MainViewInput(
            MainViewInputSource source,
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            String hitRef,
            int levelDelta
    ) {
        public MainViewInput {
            source = source == null ? MainViewInputSource.POINTER_MOVED : source;
            hitRef = hitRef == null ? "" : hitRef;
        }

        public static MainViewInput empty() {
            return new MainViewInput(MainViewInputSource.POINTER_MOVED, 0.0, 0.0, false, false, "", 0);
        }
    }

    public record RoomNarrationInput(
            long roomId,
            String visualDescription,
            List<DungeonInspectorSnapshot.RoomExitNarration> exits
    ) {
        public RoomNarrationInput {
            roomId = Math.max(0L, roomId);
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }

        public static RoomNarrationInput empty() {
            return new RoomNarrationInput(0L, "", List.of());
        }
    }

    public record Command(
            Action action,
            @Nullable DungeonMapId mapId,
            String mapName,
            String viewModeKey,
            String selectedTool,
            int projectionLevelDelta,
            OverlayData overlaySettings,
            MainViewInput mainViewInput,
            RoomNarrationInput roomNarration
    ) {
        public Command {
            action = action == null ? Action.INTERPRET_MAIN_VIEW : action;
            mapName = mapName == null ? "" : mapName;
            viewModeKey = viewModeKey == null || viewModeKey.isBlank() ? "GRID" : viewModeKey;
            selectedTool = selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
            overlaySettings = overlaySettings == null ? OverlayData.defaults() : overlaySettings;
            mainViewInput = mainViewInput == null ? MainViewInput.empty() : mainViewInput;
            roomNarration = roomNarration == null ? RoomNarrationInput.empty() : roomNarration;
        }
    }

    public record SnapshotData(
            List<DungeonMapSummary> maps,
            @Nullable DungeonMapId selectedMapId,
            String viewModeKey,
            String selectedTool,
            int projectionLevel,
            OverlayData overlaySettings,
            SelectionData selection,
            @Nullable SurfaceData surface,
            PreviewData preview,
            String statusText
    ) {
        public SnapshotData {
            maps = maps == null ? List.of() : List.copyOf(maps);
            viewModeKey = viewModeKey == null || viewModeKey.isBlank() ? "GRID" : viewModeKey;
            selectedTool = selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
            overlaySettings = overlaySettings == null ? OverlayData.defaults() : overlaySettings;
            selection = selection == null ? SelectionData.empty() : selection;
            preview = preview == null ? PreviewData.none() : preview;
            statusText = statusText == null ? "" : statusText;
        }

        public static SnapshotData empty(String statusText) {
            return new SnapshotData(
                    List.of(),
                    null,
                    "GRID",
                    "Auswahl",
                    0,
                    OverlayData.defaults(),
                    SelectionData.empty(),
                    null,
                    PreviewData.none(),
                    statusText);
        }
    }

    public record SurfaceData(
            String mapName,
            int revision,
            DungeonMapSnapshot map,
            @Nullable DungeonMapSnapshot previewMap,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        public SurfaceData {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName;
            map = map == null ? DungeonMapSnapshot.empty() : map;
        }
    }
}

final class BuildDungeonEditorSnapshotUseCase {

    record State(
            @Nullable DungeonMapId selectedMapId,
            String viewModeKey,
            String selectedTool,
            int projectionLevel,
            ApplyDungeonEditorSessionUseCase.OverlayData overlaySettings,
            ApplyDungeonEditorSessionUseCase.SelectionData selection,
            @Nullable DungeonEditorOperation previewOperation,
            String statusText
    ) {
        State {
            viewModeKey = viewModeKey == null || viewModeKey.isBlank() ? "GRID" : viewModeKey;
            selectedTool = selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
            overlaySettings = overlaySettings == null
                    ? ApplyDungeonEditorSessionUseCase.OverlayData.defaults()
                    : overlaySettings;
            selection = selection == null ? ApplyDungeonEditorSessionUseCase.SelectionData.empty() : selection;
            statusText = statusText == null ? "" : statusText;
        }
    }

    private final Function<SearchMapsQuery, SearchMapsResult> searchMaps;
    private final Function<PreviewDungeonEditorOperationQuery, DungeonOperationResult> previewOperation;
    private final Function<DescribeDungeonSelectionQuery, DungeonInspectorSnapshot> describeSelection;
    private final Function<LoadDungeonSnapshotQuery, DungeonSnapshot> loadSnapshot;

    BuildDungeonEditorSnapshotUseCase(
            Function<SearchMapsQuery, SearchMapsResult> searchMaps,
            Function<PreviewDungeonEditorOperationQuery, DungeonOperationResult> previewOperation,
            Function<DescribeDungeonSelectionQuery, DungeonInspectorSnapshot> describeSelection,
            Function<LoadDungeonSnapshotQuery, DungeonSnapshot> loadSnapshot
    ) {
        this.searchMaps = searchMaps;
        this.previewOperation = previewOperation;
        this.describeSelection = describeSelection;
        this.loadSnapshot = loadSnapshot;
    }

    ApplyDungeonEditorSessionUseCase.SnapshotData execute(State state) {
        State safeState = state == null
                ? new State(null, "GRID", "Auswahl", 0, ApplyDungeonEditorSessionUseCase.OverlayData.defaults(),
                ApplyDungeonEditorSessionUseCase.SelectionData.empty(), null, "")
                : state;
        SearchMapsResult mapsResult = searchMaps.apply(new SearchMapsQuery(""));
        List<DungeonMapSummary> maps = mapsResult == null ? List.of() : mapsResult.maps();
        DungeonMapId resolvedMapId = resolveSelectedMapId(safeState.selectedMapId(), maps);
        ApplyDungeonEditorSessionUseCase.SurfaceData surface = loadCurrentSurface(
                resolvedMapId,
                safeState.selection(),
                safeState.previewOperation());
        int clampedProjectionLevel = clampProjectionLevel(surface, safeState.projectionLevel());
        String nextStatus = safeState.statusText().isBlank()
                ? statusFromMessages(previewMessages(resolvedMapId, safeState.previewOperation()))
                : safeState.statusText();
        return new ApplyDungeonEditorSessionUseCase.SnapshotData(
                maps,
                resolvedMapId,
                safeState.viewModeKey(),
                safeState.selectedTool(),
                clampedProjectionLevel,
                safeState.overlaySettings(),
                safeState.selection(),
                surface,
                toPreview(safeState.previewOperation()),
                nextStatus);
    }

    @Nullable DungeonSnapshot loadCommittedSnapshot(@Nullable DungeonMapId mapId) {
        if (mapId == null) {
            return null;
        }
        return loadSnapshot.apply(new LoadDungeonSnapshotQuery(mapId));
    }

    private ApplyDungeonEditorSessionUseCase.@Nullable SurfaceData loadCurrentSurface(
            @Nullable DungeonMapId mapId,
            ApplyDungeonEditorSessionUseCase.SelectionData selection,
            @Nullable DungeonEditorOperation previewOperation
    ) {
        if (mapId == null) {
            return null;
        }
        DungeonSnapshot committed = loadCommittedSnapshot(mapId);
        if (committed == null) {
            return null;
        }
        DungeonInspectorSnapshot inspector = loadInspector(mapId, selection);
        if (previewOperation != null) {
            DungeonOperationResult preview = this.previewOperation.apply(new PreviewDungeonEditorOperationQuery(
                    mapId,
                    previewOperation));
            DungeonSnapshot previewSnapshot = preview == null ? null : preview.snapshot();
            DungeonMapSnapshot previewMap = previewSnapshot == null ? null : previewSnapshot.map();
            return new ApplyDungeonEditorSessionUseCase.SurfaceData(
                    committed.mapName(),
                    committed.revision(),
                    committed.map(),
                    previewMap != null && previewMap.equals(committed.map()) ? null : previewMap,
                    inspector);
        }
        return new ApplyDungeonEditorSessionUseCase.SurfaceData(
                committed.mapName(),
                committed.revision(),
                committed.map(),
                null,
                inspector);
    }

    private @Nullable DungeonOperationResult previewMessages(
            @Nullable DungeonMapId mapId,
            @Nullable DungeonEditorOperation previewOperation
    ) {
        if (mapId == null || previewOperation == null) {
            return null;
        }
        return this.previewOperation.apply(new PreviewDungeonEditorOperationQuery(mapId, previewOperation));
    }

    private @Nullable DungeonInspectorSnapshot loadInspector(
            DungeonMapId mapId,
            ApplyDungeonEditorSessionUseCase.SelectionData selection
    ) {
        if (selection.topologyRef().equals(DungeonTopologyElementRef.empty()) && !selection.clusterSelection()) {
            return null;
        }
        return describeSelection.apply(new DescribeDungeonSelectionQuery(
                mapId,
                selection.topologyRef(),
                selection.clusterId(),
                selection.clusterSelection()));
    }

    private static @Nullable DungeonMapId resolveSelectedMapId(
            @Nullable DungeonMapId requestedMapId,
            List<DungeonMapSummary> maps
    ) {
        if (requestedMapId != null && maps.stream().anyMatch(summary -> requestedMapId.equals(summary.mapId()))) {
            return requestedMapId;
        }
        return maps.isEmpty() ? null : maps.getFirst().mapId();
    }

    private static ApplyDungeonEditorSessionUseCase.PreviewData toPreview(@Nullable DungeonEditorOperation operation) {
        if (operation == null) {
            return ApplyDungeonEditorSessionUseCase.PreviewData.none();
        }
        return switch (operation) {
            case DungeonEditorOperation.PaintRoomRectangle room ->
                    new ApplyDungeonEditorSessionUseCase.RoomRectanglePreviewData(room.start(), room.end(), false);
            case DungeonEditorOperation.DeleteRoomRectangle room ->
                    new ApplyDungeonEditorSessionUseCase.RoomRectanglePreviewData(room.start(), room.end(), true);
            case DungeonEditorOperation.EditClusterBoundaries boundaries ->
                    new ApplyDungeonEditorSessionUseCase.ClusterBoundariesPreviewData(
                            boundaries.clusterId(),
                            boundaries.edges(),
                            boundaries.kind(),
                            boundaries.deleteBoundary());
            case DungeonEditorOperation.MoveEditorHandle moveHandle ->
                    new ApplyDungeonEditorSessionUseCase.MoveHandlePreviewData(
                            moveHandle.ref(),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorOperation.MoveBoundaryStretch stretch ->
                    new ApplyDungeonEditorSessionUseCase.MoveBoundaryStretchPreviewData(
                            stretch.clusterId(),
                            stretch.sourceEdges(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case DungeonEditorOperation.CreateCorridor ignored -> ApplyDungeonEditorSessionUseCase.PreviewData.none();
            case DungeonEditorOperation.ExtendCorridor ignored -> ApplyDungeonEditorSessionUseCase.PreviewData.none();
            case DungeonEditorOperation.MergeCorridors ignored -> ApplyDungeonEditorSessionUseCase.PreviewData.none();
            case DungeonEditorOperation.DeleteCorridor ignored -> ApplyDungeonEditorSessionUseCase.PreviewData.none();
            case DungeonEditorOperation.MoveTopologyElement ignored -> ApplyDungeonEditorSessionUseCase.PreviewData.none();
            case DungeonEditorOperation.MoveRoomAnchor ignored -> ApplyDungeonEditorSessionUseCase.PreviewData.none();
            case DungeonEditorOperation.SaveRoomNarration ignored -> ApplyDungeonEditorSessionUseCase.PreviewData.none();
        };
    }

    private static int clampProjectionLevel(
            ApplyDungeonEditorSessionUseCase.@Nullable SurfaceData surface,
            int projectionLevel
    ) {
        List<Integer> levels = levelsFrom(surface, projectionLevel);
        if (levels.isEmpty()) {
            return projectionLevel;
        }
        return Math.max(levels.getFirst(), Math.min(levels.getLast(), projectionLevel));
    }

    private static List<Integer> levelsFrom(
            ApplyDungeonEditorSessionUseCase.@Nullable SurfaceData surface,
            int fallbackLevel
    ) {
        TreeSet<Integer> levels = new TreeSet<>();
        if (surface != null) {
            surface.map().areas().forEach(area -> addCellLevels(levels, area.cells()));
            for (DungeonFeatureSnapshot feature : surface.map().features()) {
                addCellLevels(levels, feature.cells());
            }
            surface.map().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            if (surface.previewMap() != null) {
                surface.previewMap().areas().forEach(area -> addCellLevels(levels, area.cells()));
                for (DungeonFeatureSnapshot feature : surface.previewMap().features()) {
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

    private static void addCellLevels(Set<Integer> levels, List<DungeonCellRef> cells) {
        for (DungeonCellRef cell : cells == null ? List.<DungeonCellRef>of() : cells) {
            levels.add(cell.level());
        }
    }

    private static String statusFromMessages(@Nullable DungeonOperationResult result) {
        if (result == null) {
            return "";
        }
        if (!result.reactionMessages().isEmpty()) {
            return result.reactionMessages().getFirst();
        }
        if (!result.validationMessages().isEmpty()) {
            return result.validationMessages().getFirst();
        }
        return "";
    }
}

// Remaining interpreter code migrated from dungeon root to keep editor-session ownership in dungeoneditor.
final class InterpretDungeonEditorMainViewInputUseCase {
    private static final int MINIMUM_HIT_REF_PARTS = 2;

    private @Nullable PaintSession paintSession;
    private @Nullable BoundaryDraft boundaryDraft;
    private @Nullable CorridorDraft corridorDraft;
    private @Nullable DragSession dragSession;
    private @Nullable BoundaryStretchSession boundaryStretchSession;

    Effect consume(
            ApplyDungeonEditorSessionUseCase.MainViewInput input,
            @Nullable DungeonSnapshot snapshot,
            ApplyDungeonEditorSessionUseCase.SelectionData selection,
            String selectedTool,
            String viewModeKey,
            int projectionLevel
    ) {
        ApplyDungeonEditorSessionUseCase.MainViewInput safeInput = input == null
                ? ApplyDungeonEditorSessionUseCase.MainViewInput.empty()
                : input;
        if (safeInput.source() == ApplyDungeonEditorSessionUseCase.MainViewInputSource.LEVEL_SCROLLED) {
            return levelScrolled(safeInput.levelDelta(), selectedTool, projectionLevel, snapshot);
        }
        if (!"GRID".equalsIgnoreCase(viewModeKey) || snapshot == null) {
            return Effect.none();
        }
        PointerState pointer = resolvePointerState(
                safeInput.canvasX(),
                safeInput.canvasY(),
                projectionLevel,
                safeInput.primaryButtonDown(),
                safeInput.secondaryButtonDown(),
                safeInput.hitRef());
        return switch (safeInput.source()) {
            case POINTER_PRESSED -> primaryPressed(pointer, snapshot, selection, selectedTool);
            case POINTER_DRAGGED -> primaryDragged(pointer, snapshot, selectedTool);
            case POINTER_RELEASED -> primaryReleased(pointer, selectedTool);
            case POINTER_MOVED -> pointerMoved(pointer, snapshot, selectedTool);
            case LEVEL_SCROLLED -> Effect.none();
        };
    }

    void clear() {
        paintSession = null;
        boundaryDraft = null;
        corridorDraft = null;
        dragSession = null;
        boundaryStretchSession = null;
    }

    // The body below mirrors the prior dungeon-root implementation and keeps interaction behavior unchanged.
    // It was mechanically moved to the dungeoneditor application package with type ownership adjusted.

    private Effect primaryPressed(
            PointerState input,
            DungeonSnapshot snapshot,
            ApplyDungeonEditorSessionUseCase.SelectionData currentSelection,
            String selectedTool
    ) {
        if (input == null) {
            return Effect.none();
        }
        if (boundaryToolSelected(selectedTool)) {
            Effect boundaryEffect = boundaryPressed(input, snapshot, currentSelection, selectedTool);
            if (!boundaryEffect.isNoop()) {
                dragSession = null;
                paintSession = null;
                return boundaryEffect;
            }
        }
        if (corridorToolSelected(selectedTool)) {
            dragSession = null;
            paintSession = null;
            boundaryStretchSession = null;
            return corridorPressed(input, snapshot, selectedTool);
        }
        if (roomPaintToolSelected(selectedTool)) {
            paintSession = new PaintSession(
                    input.q(),
                    input.r(),
                    input.q(),
                    input.r(),
                    input.level(),
                    "Raum löschen".equals(selectedTool));
            dragSession = null;
            boundaryStretchSession = null;
            return previewFromPaintSession();
        }
        if (!selectionToolSelected(selectedTool)) {
            clear();
            return Effect.none();
        }
        BoundaryStretchSession nextStretchSession = boundaryStretchSession(input, snapshot, currentSelection);
        if (nextStretchSession != null) {
            dragSession = null;
            boundaryStretchSession = nextStretchSession;
            return Effect.select(nextStretchSession.selection());
        }
        HitTarget hit = input.hitTarget();
        if (selectableHit(hit)) {
            DungeonEditorHandleRef handleRef = dragHandleRef(hit);
            ApplyDungeonEditorSessionUseCase.SelectionData nextSelection = new ApplyDungeonEditorSessionUseCase.SelectionData(
                    new DungeonTopologyElementRef(
                            toPublishedTopologyKind(hit.topologyRefKind()),
                            hit.topologyRefId()),
                    hit.clusterId(),
                    clusterSelection(hit),
                    handleRef);
            dragSession = draggableHit(hit)
                    ? DragSession.start(nextSelection, input.q(), input.r(), input.level())
                    : null;
            boundaryStretchSession = null;
            return Effect.select(nextSelection);
        }
        clear();
        return Effect.clearedSelection();
    }

    private Effect primaryDragged(PointerState input, DungeonSnapshot snapshot, String selectedTool) {
        if (input == null || !input.primaryButtonDown()) {
            return Effect.none();
        }
        if (boundaryStretchSession != null) {
            boundaryStretchSession = boundaryStretchSession.withCurrentPointer(input.q(), input.r());
            return previewFromStretch(boundaryStretchSession);
        }
        if (boundaryToolSelected(selectedTool)) {
            return previewFromBoundary(input, snapshot, selectedTool);
        }
        if (paintSession != null && roomPaintToolSelected(selectedTool)) {
            paintSession = paintSession.withEnd(input.q(), input.r());
            return previewFromPaintSession();
        }
        if (!selectionToolSelected(selectedTool) || dragSession == null) {
            return Effect.clearPreviewIfNeeded(false);
        }
        dragSession = dragSession.withCurrentPointer(input.q(), input.r());
        return dragSession.moved()
                ? Effect.preview(moveHandleOperation(dragSession))
                : Effect.clearPreviewIfNeeded(true);
    }

    private Effect primaryReleased(PointerState input, String selectedTool) {
        PaintSession currentPaint = paintSession;
        if (currentPaint != null && roomPaintToolSelected(selectedTool)) {
            paintSession = null;
            PaintSession released = input == null ? currentPaint : currentPaint.withEnd(input.q(), input.r());
            return Effect.apply(released.deleteMode()
                    ? new DungeonEditorOperation.DeleteRoomRectangle(
                    new DungeonCellRef(released.startQ(), released.startR(), released.level()),
                    new DungeonCellRef(released.endQ(), released.endR(), released.level()))
                    : new DungeonEditorOperation.PaintRoomRectangle(
                    new DungeonCellRef(released.startQ(), released.startR(), released.level()),
                    new DungeonCellRef(released.endQ(), released.endR(), released.level())));
        }
        if (boundaryStretchSession != null) {
            BoundaryStretchSession releasedSession = input == null
                    ? boundaryStretchSession
                    : boundaryStretchSession.withCurrentPointer(input.q(), input.r());
            boundaryStretchSession = null;
            if (!selectionToolSelected(selectedTool)) {
                return Effect.none();
            }
            if (!releasedSession.moved()) {
                return Effect.select(releasedSession.selection());
            }
            return Effect.apply(new DungeonEditorOperation.MoveBoundaryStretch(
                    releasedSession.clusterId(),
                    releasedSession.sourceEdges(),
                    releasedSession.deltaQ(),
                    releasedSession.deltaR(),
                    releasedSession.deltaLevel()));
        }
        if (dragSession == null || input == null) {
            return Effect.clearPreviewIfNeeded(false);
        }
        DragSession releasedSession = dragSession;
        dragSession = null;
        if (!selectionToolSelected(selectedTool) || !releasedSession.moved()) {
            return Effect.clearPreviewIfNeeded(true);
        }
        return Effect.apply(moveHandleOperation(releasedSession));
    }

    private Effect pointerMoved(PointerState input, DungeonSnapshot snapshot, String selectedTool) {
        if (input == null) {
            return Effect.clearPreviewIfNeeded(boundaryDraft != null || corridorDraft != null);
        }
        if (boundaryToolSelected(selectedTool)) {
            return previewFromBoundary(input, snapshot, selectedTool);
        }
        if (corridorToolSelected(selectedTool)) {
            return previewFromCorridor(input, snapshot, selectedTool);
        }
        return Effect.clearPreviewIfNeeded(boundaryDraft != null || corridorDraft != null);
    }

    private Effect levelScrolled(int delta, String selectedTool, int projectionLevel, @Nullable DungeonSnapshot snapshot) {
        if (delta == 0) {
            return Effect.none();
        }
        if (boundaryStretchSession != null) {
            return Effect.none();
        }
        if (dragSession == null || !selectionToolSelected(selectedTool) || snapshot == null) {
            return Effect.projectionLevel(delta < 0 ? -1 : 1);
        }
        dragSession = dragSession.withCurrentLevel(projectionLevel + delta);
        return dragSession.moved()
                ? Effect.preview(moveHandleOperation(dragSession))
                : Effect.clearPreviewIfNeeded(true);
    }

    private Effect previewFromPaintSession() {
        if (paintSession == null) {
            return Effect.clearPreviewIfNeeded(true);
        }
        return Effect.preview(paintSession.deleteMode()
                ? new DungeonEditorOperation.DeleteRoomRectangle(
                new DungeonCellRef(paintSession.startQ(), paintSession.startR(), paintSession.level()),
                new DungeonCellRef(paintSession.endQ(), paintSession.endR(), paintSession.level()))
                : new DungeonEditorOperation.PaintRoomRectangle(
                new DungeonCellRef(paintSession.startQ(), paintSession.startR(), paintSession.level()),
                new DungeonCellRef(paintSession.endQ(), paintSession.endR(), paintSession.level())));
    }

    private Effect previewFromStretch(@Nullable BoundaryStretchSession stretchSession) {
        if (stretchSession == null || !stretchSession.moved()) {
            return Effect.clearPreviewIfNeeded(true);
        }
        return Effect.preview(new DungeonEditorOperation.MoveBoundaryStretch(
                stretchSession.clusterId(),
                stretchSession.sourceEdges(),
                stretchSession.deltaQ(),
                stretchSession.deltaR(),
                stretchSession.deltaLevel()));
    }

    // The rest of the interpreter is unchanged except for type ownership replacements.
    // It is intentionally kept as a mechanical move in this slice.

    private Effect previewFromBoundary(PointerState input, DungeonSnapshot snapshot, String selectedTool) {
        if ("Tür setzen".equals(selectedTool) || "Tür löschen".equals(selectedTool)) {
            BoundaryTarget boundary = input.boundaryTarget();
            boolean deleteMode = "Tür löschen".equals(selectedTool);
            if (!editableDoorBoundary(snapshot, boundary, deleteMode)) {
                return Effect.clearPreviewIfNeeded(true);
            }
            return Effect.preview(new DungeonEditorOperation.EditClusterBoundaries(
                    resolveBoundaryClusterId(snapshot, boundary),
                    List.of(new DungeonEdgeRef(boundary.start().toDungeonCellRef(), boundary.end().toDungeonCellRef())),
                    DungeonBoundaryKind.DOOR,
                    deleteMode));
        }
        if (boundaryDraft == null) {
            return Effect.clearPreviewIfNeeded(false);
        }
        Set<EdgeKey> previewEdges = new LinkedHashSet<>(boundaryDraft.previewEdges());
        PathResult candidate = previewCandidate(input, snapshot, boundaryDraft, "Wand löschen".equals(selectedTool));
        previewEdges.addAll(candidate.committedEdges());
        if (previewEdges.isEmpty()) {
            return Effect.clearPreviewIfNeeded(true);
        }
        return Effect.preview(new DungeonEditorOperation.EditClusterBoundaries(
                boundaryDraft.clusterId(),
                previewEdges.stream().map(EdgeKey::toEdgeRef).toList(),
                DungeonBoundaryKind.WALL,
                boundaryDraft.deleteMode()));
    }

    private Effect boundaryPressed(
            PointerState input,
            DungeonSnapshot snapshot,
            ApplyDungeonEditorSessionUseCase.SelectionData currentSelection,
            String selectedTool
    ) {
        if ("Tür setzen".equals(selectedTool) || "Tür löschen".equals(selectedTool)) {
            return applyDoorBoundaryPress(input, snapshot, selectedTool);
        }
        VertexTarget vertex = input.vertexTarget();
        if (vertex == null || !vertex.present()) {
            clearBoundaryDraftIfIdle();
            return Effect.none();
        }
        boolean deleteMode = "Wand löschen".equals(selectedTool);
        long clusterId = resolveClusterId(input, vertex, deleteMode, snapshot, currentSelection);
        if (clusterId <= 0L) {
            clearBoundaryDraftIfIdle();
            return Effect.none();
        }
        VertexKey nextVertex = vertexKey(vertex);
        if (boundaryDraft == null || boundaryDraft.clusterId() != clusterId) {
            return beginBoundaryDraft(snapshot, clusterId, vertex, deleteMode, nextVertex);
        }
        if (boundaryDraft.currentVertex().equals(nextVertex)) {
            return previewFromBoundary(input, snapshot, selectedTool);
        }
        return advanceBoundaryDraft(input, snapshot, selectedTool, clusterId, deleteMode, nextVertex);
    }

    private Effect applyDoorBoundaryPress(PointerState input, DungeonSnapshot snapshot, String selectedTool) {
        if (!input.primaryButtonDown()) {
            return Effect.none();
        }
        BoundaryTarget boundary = input.boundaryTarget();
        boolean deleteMode = "Tür löschen".equals(selectedTool);
        if (!editableDoorBoundary(snapshot, boundary, deleteMode)) {
            return Effect.none();
        }
        return Effect.apply(new DungeonEditorOperation.EditClusterBoundaries(
                resolveBoundaryClusterId(snapshot, boundary),
                List.of(new DungeonEdgeRef(boundary.start().toDungeonCellRef(), boundary.end().toDungeonCellRef())),
                DungeonBoundaryKind.DOOR,
                deleteMode));
    }

    private void clearBoundaryDraftIfIdle() {
        if (boundaryDraft == null) {
            clear();
        }
    }

    private Effect beginBoundaryDraft(
            DungeonSnapshot snapshot,
            long clusterId,
            VertexTarget vertex,
            boolean deleteMode,
            VertexKey nextVertex
    ) {
        if (!isEditableVertex(snapshot, clusterId, vertex, deleteMode)) {
            return Effect.none();
        }
        boundaryDraft = new BoundaryDraft(clusterId, deleteMode, nextVertex, nextVertex, Set.of());
        return Effect.clearPreviewIfNeeded(true);
    }

    private Effect advanceBoundaryDraft(
            PointerState input,
            DungeonSnapshot snapshot,
            String selectedTool,
            long clusterId,
            boolean deleteMode,
            VertexKey nextVertex
    ) {
        BoundaryDraft currentDraft = boundaryDraft;
        if (currentDraft == null) {
            return Effect.clearPreviewIfNeeded(true);
        }
        PathResult path = deleteMode
                ? findDeletePath(snapshot, clusterId, currentDraft.currentVertex(), nextVertex)
                : findCreatePath(snapshot, clusterId, currentDraft.currentVertex(), nextVertex);
        if (!path.hasRoute()) {
            return Effect.clearPreviewIfNeeded(true);
        }
        Set<EdgeKey> previewEdges = new LinkedHashSet<>(currentDraft.previewEdges());
        previewEdges.addAll(path.committedEdges());
        boundaryDraft = new BoundaryDraft(clusterId, deleteMode, currentDraft.startVertex(), nextVertex, previewEdges);
        return applyBoundaryDraftOrPreview(input, snapshot, selectedTool, clusterId, deleteMode, nextVertex);
    }

    private Effect applyBoundaryDraftOrPreview(
            PointerState input,
            DungeonSnapshot snapshot,
            String selectedTool,
            long clusterId,
            boolean deleteMode,
            VertexKey nextVertex
    ) {
        if (!deleteMode && touchesExistingWall(snapshot, clusterId, nextVertex)) {
            BoundaryDraft current = boundaryDraft;
            boundaryDraft = null;
            if (current == null) {
                return Effect.clearPreviewIfNeeded(true);
            }
            return current.previewEdges().isEmpty()
                    ? Effect.clearPreviewIfNeeded(true)
                    : Effect.apply(new DungeonEditorOperation.EditClusterBoundaries(
                    current.clusterId(),
                    current.previewEdges().stream().map(EdgeKey::toEdgeRef).toList(),
                    DungeonBoundaryKind.WALL,
                    current.deleteMode()));
        }
        return previewFromBoundary(input, snapshot, selectedTool);
    }

    private Effect corridorPressed(PointerState input, DungeonSnapshot snapshot, String selectedTool) {
        if (input == null || !input.primaryButtonDown()) {
            return Effect.none();
        }
        if ("Korridor löschen".equals(selectedTool)) {
            PendingCorridorTarget target = resolveCorridorDeleteTarget(input);
            corridorDraft = null;
            long corridorId = target == null ? 0L : target.deleteCorridorId();
            if (corridorId > 0L) {
                return Effect.applyWithStatus(new DungeonEditorOperation.DeleteCorridor(corridorId), "");
            }
            return Effect.clearedSelection();
        }
        PendingCorridorTarget target = resolveCorridorCreateTarget(input, snapshot);
        if (target == null) {
            corridorDraft = null;
            return Effect.clearedSelection();
        }
        if (corridorDraft == null) {
            corridorDraft = new CorridorDraft(target);
            return Effect.select(target.selection(), "Start: " + target.displayLabel() + ". Zieltür oder Korridoranker anklicken.");
        }
        PendingCorridorTarget start = corridorDraft.start();
        corridorDraft = null;
        if (start.targetKey().equals(target.targetKey())) {
            return Effect.select(target.selection(), "");
        }
        return applyCorridorDraft(start, target);
    }

    private Effect previewFromCorridor(PointerState input, DungeonSnapshot snapshot, String selectedTool) {
        if ("Korridor löschen".equals(selectedTool)) {
            PendingCorridorTarget target = resolveCorridorDeleteTarget(input);
            if (target == null || target.deleteCorridorId() <= 0L) {
                return Effect.clearPreviewIfNeeded(true);
            }
            return Effect.preview(new DungeonEditorOperation.DeleteCorridor(target.deleteCorridorId()));
        }
        if (corridorDraft == null) {
            return Effect.clearPreviewIfNeeded(true);
        }
        PendingCorridorTarget start = corridorDraft.start();
        PendingCorridorTarget target = resolveCorridorCreateTarget(input, snapshot);
        if (target == null || start.targetKey().equals(target.targetKey()) || start.endpoint() == null || target.endpoint() == null) {
            return Effect.clearPreviewIfNeeded(true);
        }
        return Effect.preview(new DungeonEditorOperation.CreateCorridor(start.endpoint(), target.endpoint()));
    }

    private static Effect applyCorridorDraft(PendingCorridorTarget start, PendingCorridorTarget target) {
        if (start.endpoint() != null && target.endpoint() != null) {
            return Effect.apply(new DungeonEditorOperation.CreateCorridor(start.endpoint(), target.endpoint()));
        }
        return Effect.none();
    }

    private static @Nullable PendingCorridorTarget resolveCorridorCreateTarget(PointerState input, DungeonSnapshot snapshot) {
        PendingCorridorTarget fixedDoorHandleTarget = fixedDoorHandleTarget(input.hitTarget());
        if (fixedDoorHandleTarget != null) {
            return fixedDoorHandleTarget;
        }
        PendingCorridorTarget fixedDoorTarget = fixedDoorBoundaryTarget(input, snapshot);
        if (fixedDoorTarget != null) {
            return fixedDoorTarget;
        }
        PendingCorridorTarget perimeterWallTarget = perimeterWallTarget(input, snapshot);
        if (perimeterWallTarget != null) {
            return perimeterWallTarget;
        }
        PendingCorridorTarget explicitAnchorTarget = explicitAnchorTarget(input.hitTarget());
        if (explicitAnchorTarget != null) {
            return explicitAnchorTarget;
        }
        PendingCorridorTarget roomTarget = roomTarget(input, snapshot, input.hitTarget());
        if (roomTarget != null) {
            return roomTarget;
        }
        PendingCorridorTarget corridorTarget = corridorTarget(input);
        if (corridorTarget != null) {
            return corridorTarget;
        }
        return null;
    }

    private static @Nullable PendingCorridorTarget resolveCorridorDeleteTarget(PointerState input) {
        PendingCorridorTarget explicitAnchorTarget = explicitAnchorTarget(input.hitTarget());
        if (explicitAnchorTarget != null) {
            return explicitAnchorTarget;
        }
        return corridorTarget(input);
    }

    private static @Nullable PendingCorridorTarget fixedDoorHandleTarget(@Nullable HitTarget hit) {
        if (hit == null
                || hit.handleRef() == null
                || !"DOOR".equals(hit.handleRef().kind())
                || hit.handleRef().roomId() <= 0L
                || hit.handleRef().clusterId() <= 0L
                || hit.handleRef().direction().isBlank()
                || hit.topologyRefId() <= 0L) {
            return null;
        }
        DungeonEditorHandleRef handleRef = hit.handleRef().toDungeonHandleRef();
        return new PendingCorridorTarget.EndpointTarget(
                "room:" + hit.handleRef().roomId() + ":door:" + hit.topologyRefId(),
                "Tür " + hit.topologyRefId(),
                new ApplyDungeonEditorSessionUseCase.SelectionData(
                        new DungeonTopologyElementRef(DungeonTopologyElementKind.DOOR, hit.topologyRefId()),
                        hit.handleRef().clusterId(),
                        false,
                        handleRef),
                0L,
                new DungeonEditorOperation.CorridorDoorEndpoint(
                        hit.handleRef().roomId(),
                        hit.handleRef().clusterId(),
                        hit.handleRef().anchor().toDungeonCellRef(),
                        hit.handleRef().direction(),
                        new DungeonTopologyElementRef(DungeonTopologyElementKind.DOOR, hit.topologyRefId())));
    }

    private static @Nullable PendingCorridorTarget fixedDoorBoundaryTarget(PointerState input, DungeonSnapshot snapshot) {
        BoundaryTarget boundary = input == null ? null : input.boundaryTarget();
        BoundaryRoomTouch roomTouch = singleRoomTouch(snapshot, boundary, true);
        if (roomTouch == null || boundary == null) {
            return null;
        }
        String direction = boundaryDirectionForRoomCell(boundary, roomTouch.roomCell());
        if (direction.isBlank()) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "room:" + roomTouch.room().id() + ":door:" + boundary.topologyRefId(),
                "Tür " + boundary.topologyRefId(),
                selectionForBoundary(boundary, roomTouch.room().clusterId()),
                0L,
                new DungeonEditorOperation.CorridorDoorEndpoint(
                        roomTouch.room().id(),
                        roomTouch.room().clusterId(),
                        roomTouch.roomCell(),
                        direction,
                        new DungeonTopologyElementRef(
                                toPublishedTopologyKind(boundary.topologyRefKind()),
                                boundary.topologyRefId())));
    }

    private static @Nullable PendingCorridorTarget perimeterWallTarget(PointerState input, DungeonSnapshot snapshot) {
        BoundaryTarget boundary = input == null ? null : input.boundaryTarget();
        BoundaryRoomTouch roomTouch = singleRoomTouch(snapshot, boundary, false);
        if (roomTouch == null || boundary == null) {
            return null;
        }
        String direction = boundaryDirectionForRoomCell(boundary, roomTouch.roomCell());
        if (direction.isBlank()) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "room:" + roomTouch.room().id() + ":wall:" + boundary.start().q() + ":" + boundary.start().r()
                        + ":" + boundary.end().q() + ":" + boundary.end().r() + ":" + boundary.start().level(),
                roomTouch.room().label().isBlank() ? "Raum " + roomTouch.room().id() : roomTouch.room().label(),
                selectionForBoundary(boundary, roomTouch.room().clusterId()),
                0L,
                new DungeonEditorOperation.CorridorDoorEndpoint(
                        roomTouch.room().id(),
                        roomTouch.room().clusterId(),
                        roomTouch.roomCell(),
                        direction,
                        DungeonTopologyElementRef.empty()));
    }

    private static @Nullable PendingCorridorTarget explicitAnchorTarget(@Nullable HitTarget hit) {
        if (hit == null || hit.handleRef() == null || !"CORRIDOR_ANCHOR".equals(hit.handleRef().kind())) {
            return null;
        }
        long hostCorridorId = hit.handleRef().corridorId();
        if (hostCorridorId <= 0L) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "anchor:" + hit.topologyRefId(),
                "Anker " + hit.topologyRefId(),
                new ApplyDungeonEditorSessionUseCase.SelectionData(
                        new DungeonTopologyElementRef(DungeonTopologyElementKind.CORRIDOR, hostCorridorId),
                        0L,
                        false,
                        null),
                hostCorridorId,
                new DungeonEditorOperation.CorridorAnchorEndpoint(
                        hostCorridorId,
                        hit.handleRef().anchor().toDungeonCellRef(),
                        new DungeonTopologyElementRef(DungeonTopologyElementKind.CORRIDOR_ANCHOR, hit.topologyRefId())));
    }

    private static @Nullable PendingCorridorTarget corridorTarget(PointerState input) {
        HitTarget hit = input == null ? null : input.hitTarget();
        if (hit == null) {
            return null;
        }
        long corridorId = hit.topologyRefId() > 0L && "CORRIDOR".equals(hit.topologyRefKind())
                ? hit.topologyRefId()
                : hit.kind() == HitKind.CORRIDOR ? hit.ownerId() : 0L;
        if (corridorId <= 0L) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "corridor:" + corridorId + ":" + input.q() + ":" + input.r() + ":" + input.level(),
                "Korridor " + corridorId,
                new ApplyDungeonEditorSessionUseCase.SelectionData(
                        new DungeonTopologyElementRef(DungeonTopologyElementKind.CORRIDOR, corridorId),
                        0L,
                        false,
                        null),
                corridorId,
                new DungeonEditorOperation.CorridorAnchorEndpoint(
                        corridorId,
                        new DungeonCellRef(input.q(), input.r(), input.level()),
                        DungeonTopologyElementRef.empty()));
    }

    private static @Nullable PendingCorridorTarget roomTarget(PointerState input, DungeonSnapshot snapshot, HitTarget hit) {
        DungeonAreaSnapshot room = roomArea(snapshot, hit);
        if (room == null) {
            return null;
        }
        DungeonCellRef roomCell = corridorRoomCell(room, input.q(), input.r());
        String direction = corridorDirection(room, roomCell);
        if (direction.isBlank()) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "room:" + room.id(),
                room.label().isBlank() ? "Raum " + room.id() : room.label(),
                new ApplyDungeonEditorSessionUseCase.SelectionData(room.topologyRef(), room.clusterId(), false, null),
                room.clusterId(),
                new DungeonEditorOperation.CorridorDoorEndpoint(
                        room.id(),
                        room.clusterId(),
                        roomCell,
                        direction,
                        DungeonTopologyElementRef.empty()));
    }

    private @Nullable BoundaryStretchSession boundaryStretchSession(
            PointerState input,
            DungeonSnapshot snapshot,
            ApplyDungeonEditorSessionUseCase.SelectionData currentSelection
    ) {
        BoundaryTarget boundaryTarget = input == null ? null : input.boundaryTarget();
        if (input == null || !input.primaryButtonDown() || boundaryTarget == null || !boundaryTarget.present()) {
            return null;
        }
        BoundaryStretchOrientation orientation = BoundaryStretchOrientation.from(boundaryTarget);
        if (orientation == null) {
            return null;
        }
        long clusterId = resolveBoundaryClusterId(snapshot, boundaryTarget);
        if (clusterId <= 0L) {
            return null;
        }
        List<DungeonEdgeRef> sourceEdges = resolveBoundaryStretchEdges(snapshot, clusterId, boundaryTarget, orientation);
        if (sourceEdges.isEmpty()) {
            return null;
        }
        ApplyDungeonEditorSessionUseCase.SelectionData nextSelection =
                selectionForBoundaryStretch(snapshot, currentSelection, clusterId, boundaryTarget);
        return new BoundaryStretchSession(
                nextSelection,
                clusterId,
                sourceEdges,
                orientation,
                input.q(),
                input.r(),
                input.level(),
                input.q(),
                input.r());
    }

    private static ApplyDungeonEditorSessionUseCase.SelectionData selectionForBoundaryStretch(
            DungeonSnapshot snapshot,
            ApplyDungeonEditorSessionUseCase.SelectionData currentSelection,
            long clusterId,
            BoundaryTarget boundaryTarget
    ) {
        if (currentSelection != null && currentSelection.clusterSelection() && currentSelection.clusterId() == clusterId) {
            return currentSelection;
        }
        DungeonAreaSnapshot clusterArea = firstClusterArea(snapshot, clusterId);
        if (clusterArea != null) {
            return new ApplyDungeonEditorSessionUseCase.SelectionData(clusterArea.topologyRef(), clusterArea.clusterId(), true, null);
        }
        return new ApplyDungeonEditorSessionUseCase.SelectionData(
                new DungeonTopologyElementRef(toPublishedTopologyKind(boundaryTarget.topologyRefKind()), boundaryTarget.topologyRefId()),
                clusterId,
                true,
                null);
    }

    private static @Nullable DungeonAreaSnapshot firstClusterArea(DungeonSnapshot snapshot, long clusterId) {
        if (snapshot == null || snapshot.map() == null || clusterId <= 0L) {
            return null;
        }
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }

    private static List<DungeonEdgeRef> resolveBoundaryStretchEdges(
            DungeonSnapshot snapshot,
            long clusterId,
            BoundaryTarget boundaryTarget,
            BoundaryStretchOrientation orientation
    ) {
        if (snapshot == null || snapshot.map() == null || !boundaryTarget.present()) {
            return List.of();
        }
        int level = boundaryTarget.start().level();
        Set<DungeonCellRef> clusterCells = clusterCells(snapshot, clusterId, level);
        if (clusterCells.isEmpty()) {
            return List.of();
        }
        DungeonEdgeRef clickedEdge = new DungeonEdgeRef(
                boundaryTarget.start().toDungeonCellRef(),
                boundaryTarget.end().toDungeonCellRef());
        Boolean outer = outerStretch(clickedEdge, clusterCells);
        if (outer == null) {
            return List.of();
        }
        Map<Integer, DungeonEdgeRef> edgesByVariable =
                boundaryStretchEdgesOnLine(snapshot, clusterCells, clickedEdge, orientation, outer);
        List<DungeonEdgeRef> contiguousEdges = contiguousStretchEdges(edgesByVariable, clickedEdge, orientation);
        return contiguousEdges.isEmpty() ? List.of(clickedEdge) : contiguousEdges;
    }

    private static @Nullable Boolean outerStretch(DungeonEdgeRef clickedEdge, Set<DungeonCellRef> clusterCells) {
        int clickedTouchCount = touchingClusterCount(clickedEdge, clusterCells);
        if (clickedTouchCount == 0) {
            return null;
        }
        return clickedTouchCount == 1;
    }

    private static Map<Integer, DungeonEdgeRef> boundaryStretchEdgesOnLine(
            DungeonSnapshot snapshot,
            Set<DungeonCellRef> clusterCells,
            DungeonEdgeRef clickedEdge,
            BoundaryStretchOrientation orientation,
            boolean outer
    ) {
        Map<Integer, DungeonEdgeRef> edgesByVariable = new LinkedHashMap<>();
        int level = clickedEdge.from().level();
        int fixedCoordinate = fixedCoordinate(orientation, clickedEdge);
        for (DungeonBoundarySnapshot boundary : snapshot.map().boundaries()) {
            DungeonEdgeRef edge = boundary.edge();
            if (!matchesStretchLine(edge, clusterCells, level, orientation, fixedCoordinate, outer)) {
                continue;
            }
            edgesByVariable.put(variableCoordinate(orientation, edge), edge);
        }
        return edgesByVariable;
    }

    private static boolean matchesStretchLine(
            @Nullable DungeonEdgeRef edge,
            Set<DungeonCellRef> clusterCells,
            int level,
            BoundaryStretchOrientation orientation,
            int fixedCoordinate,
            boolean outer
    ) {
        if (edge == null
                || edge.from() == null
                || edge.to() == null
                || edge.from().level() != level
                || edge.to().level() != level
                    || !sameOrientation(orientation, edge)
                    || fixedCoordinate(orientation, edge) != fixedCoordinate) {
            return false;
        }
        int touchCount = touchingClusterCount(edge, clusterCells);
        boolean outerEdge = touchCount == 1;
        return touchCount > 0 && outerEdge == outer;
    }

    private static List<DungeonEdgeRef> contiguousStretchEdges(
            Map<Integer, DungeonEdgeRef> edgesByVariable,
            DungeonEdgeRef clickedEdge,
            BoundaryStretchOrientation orientation
    ) {
        int min = variableCoordinate(orientation, clickedEdge);
        int max = min;
        while (edgesByVariable.containsKey(min - 1)) {
            min--;
        }
        while (edgesByVariable.containsKey(max + 1)) {
            max++;
        }
        List<DungeonEdgeRef> result = new ArrayList<>();
        for (int variable = min; variable <= max; variable++) {
            DungeonEdgeRef edge = edgesByVariable.get(variable);
            if (edge != null) {
                result.add(edge);
            }
        }
        return List.copyOf(result);
    }

    private static Set<DungeonCellRef> clusterCells(DungeonSnapshot snapshot, long clusterId, int level) {
        if (snapshot == null || snapshot.map() == null || clusterId <= 0L) {
            return Set.of();
        }
        Set<DungeonCellRef> result = new LinkedHashSet<>();
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM || area.clusterId() != clusterId) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                if (cell.level() == level) {
                    result.add(cell);
                }
            }
        }
        return Set.copyOf(result);
    }

    private static int touchingClusterCount(DungeonEdgeRef edge, Set<DungeonCellRef> clusterCells) {
        if (edge == null || edge.from() == null || edge.to() == null || edge.from().level() != edge.to().level()) {
            return 0;
        }
        if (edge.from().r() == edge.to().r()) {
            return horizontalTouchingClusterCount(edge.from(), edge.to(), clusterCells);
        }
        if (edge.from().q() == edge.to().q()) {
            return verticalTouchingClusterCount(edge.from(), edge.to(), clusterCells);
        }
        return 0;
    }

    private static int horizontalTouchingClusterCount(
            DungeonCellRef from,
            DungeonCellRef to,
            Set<DungeonCellRef> clusterCells
    ) {
        int count = 0;
        for (int q = Math.min(from.q(), to.q()); q < Math.max(from.q(), to.q()); q++) {
            if (clusterCells.contains(new DungeonCellRef(q, from.r() - 1, from.level()))) {
                count++;
            }
            if (clusterCells.contains(new DungeonCellRef(q, from.r(), from.level()))) {
                count++;
            }
        }
        return count;
    }

    private static int verticalTouchingClusterCount(
            DungeonCellRef from,
            DungeonCellRef to,
            Set<DungeonCellRef> clusterCells
    ) {
        int count = 0;
        for (int r = Math.min(from.r(), to.r()); r < Math.max(from.r(), to.r()); r++) {
            if (clusterCells.contains(new DungeonCellRef(from.q() - 1, r, from.level()))) {
                count++;
            }
            if (clusterCells.contains(new DungeonCellRef(from.q(), r, from.level()))) {
                count++;
            }
        }
        return count;
    }

    private static boolean sameOrientation(BoundaryStretchOrientation orientation, DungeonEdgeRef edge) {
        return switch (orientation) {
            case HORIZONTAL -> edge.from().r() == edge.to().r();
            case VERTICAL -> edge.from().q() == edge.to().q();
        };
    }

    private static int fixedCoordinate(BoundaryStretchOrientation orientation, DungeonEdgeRef edge) {
        return orientation == BoundaryStretchOrientation.VERTICAL ? edge.from().q() : edge.from().r();
    }

    private static int variableCoordinate(BoundaryStretchOrientation orientation, DungeonEdgeRef edge) {
        return orientation == BoundaryStretchOrientation.VERTICAL
                ? Math.min(edge.from().r(), edge.to().r())
                : Math.min(edge.from().q(), edge.to().q());
    }

    private static boolean editableDoorBoundary(@Nullable DungeonSnapshot snapshot, @Nullable BoundaryTarget boundary, boolean deleteMode) {
        if (boundary == null || !boundary.present()) {
            return false;
        }
        if (deleteMode) {
            return "DOOR".equals(boundary.kind());
        }
        return !"DOOR".equals(boundary.kind()) && touchingRoomCount(snapshot, boundary) >= 1;
    }

    private static int touchingRoomCount(@Nullable DungeonSnapshot snapshot, BoundaryTarget boundary) {
        if (snapshot == null || snapshot.map() == null || boundary == null) {
            return 0;
        }
        Set<Long> roomIds = new LinkedHashSet<>();
        List<CellKey> touchingCells = touchingCells(
                boundary.start().toDungeonCellRef(),
                boundary.end().toDungeonCellRef()).stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .toList();
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                if (touchingCells.contains(new CellKey(cell.q(), cell.r(), cell.level()))) {
                    roomIds.add(area.id());
                }
            }
        }
        return roomIds.size();
    }

    private static long resolveBoundaryClusterId(@Nullable DungeonSnapshot snapshot, @Nullable BoundaryTarget boundaryTarget) {
        if (snapshot == null || snapshot.map() == null || boundaryTarget == null || !boundaryTarget.present()) {
            return 0L;
        }
        List<CellKey> touchingCells = touchingCells(
                boundaryTarget.start().toDungeonCellRef(),
                boundaryTarget.end().toDungeonCellRef()).stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .toList();
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() > 0L)
                .filter(area -> area.cells().stream()
                        .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                        .anyMatch(touchingCells::contains))
                .map(DungeonAreaSnapshot::clusterId)
                .findFirst()
                .orElse(0L);
    }

    private static long resolveClusterId(
            PointerState input,
            VertexTarget vertex,
            boolean deleteMode,
            DungeonSnapshot snapshot,
            ApplyDungeonEditorSessionUseCase.SelectionData selection
    ) {
        if (selection != null
                && selection.clusterId() > 0L
                && isEditableVertex(snapshot, selection.clusterId(), vertex, deleteMode)) {
            return selection.clusterId();
        }
        BoundaryTarget boundary = input.boundaryTarget();
        long boundaryClusterId = resolveBoundaryClusterId(snapshot, boundary);
        if (boundaryClusterId > 0L && isEditableVertex(snapshot, boundaryClusterId, vertex, deleteMode)) {
            return boundaryClusterId;
        }
        return nearestEditableCluster(snapshot, vertex, deleteMode);
    }

    private static long nearestEditableCluster(DungeonSnapshot snapshot, VertexTarget vertex, boolean deleteMode) {
        return clusterCellsByCluster(snapshot, vertex.level()).entrySet().stream()
                .filter(entry -> isEditableVertex(snapshot, entry.getKey(), vertex, deleteMode))
                .min(Comparator
                        .comparingDouble((Map.Entry<Long, Set<CellKey>> entry) -> centerDistance(entry.getValue(), vertex))
                        .thenComparingLong(Map.Entry::getKey))
                .map(Map.Entry::getKey)
                .orElse(0L);
    }

    private static double centerDistance(Set<CellKey> cells, VertexTarget vertex) {
        double q = 0.0;
        double r = 0.0;
        for (CellKey cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        int count = Math.max(1, cells.size());
        return Math.hypot(q / count - vertex.q(), r / count - vertex.r());
    }

    private static boolean isEditableVertex(DungeonSnapshot snapshot, long clusterId, VertexTarget vertex, boolean deleteMode) {
        Set<EdgeKey> edges = deleteMode
                ? existingInternalBoundaryEdges(snapshot, clusterId, vertex.level(), DungeonBoundaryKind.WALL)
                : internalClusterEdges(snapshot, clusterId, vertex.level());
        VertexKey key = new VertexKey(vertex.q(), vertex.r(), vertex.level());
        return edges.stream().anyMatch(edge -> edge.touches(key));
    }

    private static PathResult previewCandidate(
            PointerState input,
            DungeonSnapshot snapshot,
            BoundaryDraft currentDraft,
            boolean deleteMode
    ) {
        VertexTarget vertex = input == null ? null : input.vertexTarget();
        if (snapshot == null || vertex == null || !vertex.present()) {
            return PathResult.empty();
        }
        if (!isEditableVertex(snapshot, currentDraft.clusterId(), vertex, deleteMode)) {
            return PathResult.empty();
        }
        VertexKey nextVertex = vertexKey(vertex);
        if (currentDraft.currentVertex().equals(nextVertex)) {
            return PathResult.empty();
        }
        return deleteMode
                ? findDeletePath(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex)
                : findCreatePath(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex);
    }

    private static PathResult findCreatePath(DungeonSnapshot snapshot, long clusterId, VertexKey start, VertexKey goal) {
        Set<EdgeKey> traversableEdges = internalClusterEdges(snapshot, clusterId, start.level());
        List<EdgeKey> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        Set<EdgeKey> doors = existingInternalBoundaryEdges(snapshot, clusterId, start.level(), DungeonBoundaryKind.DOOR);
        Set<EdgeKey> committed = new LinkedHashSet<>(route);
        committed.removeAll(doors);
        return new PathResult(route, committed);
    }

    private static PathResult findDeletePath(DungeonSnapshot snapshot, long clusterId, VertexKey start, VertexKey goal) {
        Set<EdgeKey> walls = existingInternalBoundaryEdges(snapshot, clusterId, start.level(), DungeonBoundaryKind.WALL);
        List<EdgeKey> route = shortestPath(start, goal, walls);
        return route.isEmpty() ? PathResult.empty() : new PathResult(route, new LinkedHashSet<>(route));
    }

    private static List<EdgeKey> shortestPath(VertexKey start, VertexKey goal, Set<EdgeKey> traversableEdges) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        Map<VertexKey, Set<VertexKey>> adjacency = adjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        ArrayDeque<VertexKey> queue = new ArrayDeque<>();
        Map<VertexKey, VertexKey> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            VertexKey current = queue.removeFirst();
            if (current.equals(goal)) {
                break;
            }
            for (VertexKey neighbor : adjacency.getOrDefault(current, Set.of()).stream().sorted(VertexKey.ORDER).toList()) {
                if (previous.containsKey(neighbor)) {
                    continue;
                }
                previous.put(neighbor, current);
                queue.addLast(neighbor);
            }
        }
        if (!previous.containsKey(goal)) {
            return List.of();
        }
        List<EdgeKey> path = new ArrayList<>();
        VertexKey current = goal;
        while (!current.equals(start)) {
            VertexKey parent = previous.get(current);
            if (parent == null) {
                return List.of();
            }
            path.add(EdgeKey.between(parent, current));
            current = parent;
        }
        Collections.reverse(path);
        return List.copyOf(path);
    }

    private static Map<VertexKey, Set<VertexKey>> adjacency(Set<EdgeKey> edges) {
        Map<VertexKey, Set<VertexKey>> result = new LinkedHashMap<>();
        for (EdgeKey edge : edges == null ? Set.<EdgeKey>of() : edges) {
            result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
        }
        return Map.copyOf(result);
    }

    private static Set<EdgeKey> internalClusterEdges(DungeonSnapshot snapshot, long clusterId, int level) {
        Set<CellKey> cells = clusterCellsByCluster(snapshot, level).getOrDefault(clusterId, Set.of());
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            for (Direction direction : Direction.values()) {
                CellKey neighbor = cell.neighbor(direction);
                if (cells.contains(neighbor)) {
                    result.add(EdgeKey.sideOf(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static Set<EdgeKey> existingInternalBoundaryEdges(
            DungeonSnapshot snapshot,
            long clusterId,
            int level,
            DungeonBoundaryKind kind
    ) {
        Set<EdgeKey> internalEdges = internalClusterEdges(snapshot, clusterId, level);
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (DungeonBoundarySnapshot boundary : boundaries(snapshot)) {
            if (boundary.edge() == null
                    || boundary.edge().from() == null
                    || boundary.edge().to() == null
                    || boundary.edge().from().level() != level
                    || !boundaryKindMatches(boundary, kind)) {
                continue;
            }
            EdgeKey edge = EdgeKey.from(boundary.edge());
            if (internalEdges.contains(edge)) {
                result.add(edge);
            }
        }
        return Set.copyOf(result);
    }

    private static boolean touchesExistingWall(DungeonSnapshot snapshot, long clusterId, VertexKey vertex) {
        Set<EdgeKey> edges = new LinkedHashSet<>(existingInternalBoundaryEdges(
                snapshot,
                clusterId,
                vertex.level(),
                DungeonBoundaryKind.WALL));
        edges.addAll(outerClusterEdges(snapshot, clusterId, vertex.level()));
        return edges.stream().anyMatch(edge -> edge.touches(vertex));
    }

    private static Set<EdgeKey> outerClusterEdges(DungeonSnapshot snapshot, long clusterId, int level) {
        Set<CellKey> cells = clusterCellsByCluster(snapshot, level).getOrDefault(clusterId, Set.of());
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            for (Direction direction : Direction.values()) {
                if (!cells.contains(cell.neighbor(direction))) {
                    result.add(EdgeKey.sideOf(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static Map<Long, Set<CellKey>> clusterCellsByCluster(DungeonSnapshot snapshot, int level) {
        Map<Long, Set<CellKey>> result = new LinkedHashMap<>();
        if (snapshot == null || snapshot.map() == null) {
            return Map.of();
        }
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM || area.clusterId() <= 0L) {
                continue;
            }
            Set<CellKey> cells = result.computeIfAbsent(area.clusterId(), ignored -> new LinkedHashSet<>());
            for (DungeonCellRef cell : area.cells()) {
                if (cell.level() == level) {
                    cells.add(new CellKey(cell.q(), cell.r(), cell.level()));
                }
            }
        }
        Map<Long, Set<CellKey>> immutable = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<CellKey>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(immutable);
    }

    private static List<DungeonBoundarySnapshot> boundaries(DungeonSnapshot snapshot) {
        return snapshot == null || snapshot.map() == null ? List.of() : snapshot.map().boundaries();
    }

    private static boolean boundaryKindMatches(DungeonBoundarySnapshot boundary, DungeonBoundaryKind kind) {
        if (kind == DungeonBoundaryKind.DOOR) {
            return "door".equalsIgnoreCase(boundary.kind());
        }
        return !"door".equalsIgnoreCase(boundary.kind());
    }

    private static @Nullable DungeonAreaSnapshot roomArea(DungeonSnapshot snapshot, HitTarget hit) {
        if (snapshot == null || snapshot.map() == null || hit == null) {
            return null;
        }
        if (hit.kind() == HitKind.ROOM && hit.ownerId() > 0L) {
            return roomAreaById(snapshot, hit.ownerId());
        }
        if (hit.kind() == HitKind.LABEL && "ROOM".equals(hit.topologyRefKind()) && hit.topologyRefId() > 0L) {
            return roomAreaById(snapshot, hit.topologyRefId());
        }
        if (hit.kind() == HitKind.LABEL && hit.clusterId() > 0L) {
            return snapshot.map().areas().stream()
                    .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() == hit.clusterId())
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    private static @Nullable DungeonAreaSnapshot roomAreaById(DungeonSnapshot snapshot, long roomId) {
        if (snapshot == null || snapshot.map() == null || roomId <= 0L) {
            return null;
        }
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.id() == roomId)
                .findFirst()
                .orElse(null);
    }

    private static DungeonCellRef corridorRoomCell(DungeonAreaSnapshot room, int pointerQ, int pointerR) {
        return room.cells().stream()
                .min(Comparator
                        .comparingInt((DungeonCellRef cell) -> Math.abs(cell.q() - pointerQ) + Math.abs(cell.r() - pointerR))
                        .thenComparingInt(DungeonCellRef::r)
                        .thenComparingInt(DungeonCellRef::q))
                .orElse(new DungeonCellRef(pointerQ, pointerR, 0));
    }

    private static String corridorDirection(DungeonAreaSnapshot room, DungeonCellRef roomCell) {
        Set<CellKey> roomCells = room.cells().stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        CellKey key = new CellKey(roomCell.q(), roomCell.r(), roomCell.level());
        for (Direction direction : Direction.values()) {
            if (!roomCells.contains(key.neighbor(direction))) {
                return direction.name();
            }
        }
        return "";
    }

    private static @Nullable BoundaryRoomTouch singleRoomTouch(
            DungeonSnapshot snapshot,
            @Nullable BoundaryTarget boundary,
            boolean requireDoorBoundary
    ) {
        if (snapshot == null || snapshot.map() == null || boundary == null || !boundary.present()) {
            return null;
        }
        boolean doorBoundary = "DOOR".equals(boundary.kind());
        if (requireDoorBoundary != doorBoundary) {
            return null;
        }
        List<DungeonCellRef> touchingCells = touchingCells(boundary.start().toDungeonCellRef(), boundary.end().toDungeonCellRef());
        List<BoundaryRoomTouch> touches = roomTouches(snapshot.map().areas(), touchingCells);
        return touches.size() == 1 ? touches.getFirst() : null;
    }

    private static List<BoundaryRoomTouch> roomTouches(
            List<DungeonAreaSnapshot> areas,
            List<DungeonCellRef> touchingCells
    ) {
        List<BoundaryRoomTouch> touches = new ArrayList<>();
        for (DungeonAreaSnapshot area : areas) {
            if (area.kind() != DungeonAreaKind.ROOM) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                if (touchingCells.contains(cell)) {
                    touches.add(new BoundaryRoomTouch(area, cell));
                    break;
                }
            }
        }
        return touches;
    }

    private static String boundaryDirectionForRoomCell(BoundaryTarget boundary, DungeonCellRef roomCell) {
        if (boundary == null || roomCell == null) {
            return "";
        }
        EdgeKey boundaryKey = EdgeKey.from(new DungeonEdgeRef(boundary.start().toDungeonCellRef(), boundary.end().toDungeonCellRef()));
        CellKey cellKey = new CellKey(roomCell.q(), roomCell.r(), roomCell.level());
        for (Direction direction : Direction.values()) {
            if (EdgeKey.sideOf(cellKey, direction).equals(boundaryKey)) {
                return direction.name();
            }
        }
        return "";
    }

    private static ApplyDungeonEditorSessionUseCase.SelectionData selectionForBoundary(BoundaryTarget boundary, long clusterId) {
        return new ApplyDungeonEditorSessionUseCase.SelectionData(
                new DungeonTopologyElementRef(toPublishedTopologyKind(boundary.topologyRefKind()), boundary.topologyRefId()),
                clusterId,
                false,
                null);
    }

    private static PointerState resolvePointerState(
            double canvasX,
            double canvasY,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            String hitRef
    ) {
        int q = (int) Math.floor(canvasX);
        int r = (int) Math.floor(canvasY);
        HitTarget hitTarget = parseHitTarget(hitRef);
        BoundaryTarget boundaryTarget = hitTarget.boundaryTarget();
        return new PointerState(
                q,
                r,
                level,
                primaryButtonDown,
                secondaryButtonDown,
                hitTarget,
                toVertexTarget(canvasX, canvasY, level),
                boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget);
    }

    private static VertexTarget toVertexTarget(double canvasX, double canvasY, int level) {
        int vertexQ = (int) Math.round(canvasX);
        int vertexR = (int) Math.round(canvasY);
        double distance = Math.hypot(canvasX - vertexQ, canvasY - vertexR);
        return distance <= 0.22
                ? new VertexTarget(true, vertexQ, vertexR, level)
                : VertexTarget.empty();
    }

    private static HitTarget parseHitTarget(String hitRef) {
        if (hitRef == null || hitRef.isBlank()) {
            return HitTarget.empty();
        }
        String[] parts = hitRef.split(":", -1);
        if (parts.length < MINIMUM_HIT_REF_PARTS) {
            return HitTarget.empty();
        }
        return switch (parts[0]) {
            case "cell" -> new HitTarget(
                    toHitKind(parts[1]),
                    parseLong(parts, 2),
                    parseLong(parts, 3),
                    part(parts, 4),
                    parseLong(parts, 5),
                    HandleTarget.empty(),
                    BoundaryTarget.empty());
            case "label" -> new HitTarget(
                    HitKind.LABEL,
                    parseLong(parts, 1),
                    parseLong(parts, 2),
                    part(parts, 3),
                    parseLong(parts, 4),
                    HandleTarget.clusterLabel(part(parts, 3), parseLong(parts, 4), parseLong(parts, 1), parseLong(parts, 2)),
                    BoundaryTarget.empty());
            case "marker" -> {
                HandleTarget handleTarget = new HandleTarget(
                        part(parts, 1),
                        part(parts, 2),
                        parseLong(parts, 3),
                        parseLong(parts, 4),
                        parseLong(parts, 5),
                        parseLong(parts, 6),
                        parseLong(parts, 7),
                        parseInt(parts, 8),
                        new CellTarget(parseInt(parts, 9), parseInt(parts, 10), parseInt(parts, 11)),
                        part(parts, 12));
                yield new HitTarget(
                        HitKind.HANDLE,
                        handleTarget.ownerId(),
                        handleTarget.clusterId(),
                        handleTarget.topologyRefKind(),
                        handleTarget.topologyRefId(),
                        handleTarget,
                        BoundaryTarget.empty());
            }
            case "edge" -> {
                BoundaryTarget boundaryTarget = new BoundaryTarget(
                        true,
                        part(parts, 1),
                        parseLong(parts, 2),
                        0L,
                        part(parts, 3),
                        parseLong(parts, 4),
                        new CellTarget(parseInt(parts, 6), parseInt(parts, 7), parseInt(parts, 5)),
                        new CellTarget(parseInt(parts, 8), parseInt(parts, 9), parseInt(parts, 5)));
                yield new HitTarget(
                        HitKind.BOUNDARY,
                        boundaryTarget.ownerId(),
                        0L,
                        boundaryTarget.topologyRefKind(),
                        boundaryTarget.topologyRefId(),
                        HandleTarget.clusterLabel(boundaryTarget.topologyRefKind(),
                                boundaryTarget.topologyRefId(),
                                boundaryTarget.ownerId(),
                                0L),
                        boundaryTarget);
            }
            case "graph-node" -> new HitTarget(
                    HitKind.LABEL,
                    parseLong(parts, 2),
                    parseLong(parts, 3),
                    part(parts, 1),
                    parseLong(parts, 2),
                    HandleTarget.clusterLabel(part(parts, 1), parseLong(parts, 2), parseLong(parts, 2), parseLong(parts, 3)),
                    BoundaryTarget.empty());
            default -> HitTarget.empty();
        };
    }

    private static String part(String[] parts, int index) {
        return index >= 0 && index < parts.length ? parts[index] : "";
    }

    private static long parseLong(String[] parts, int index) {
        try {
            return Long.parseLong(part(parts, index));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private static int parseInt(String[] parts, int index) {
        try {
            return Integer.parseInt(part(parts, index));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static HitKind toHitKind(String kind) {
        return switch (kind == null ? "" : kind) {
            case "ROOM" -> HitKind.ROOM;
            case "CORRIDOR" -> HitKind.CORRIDOR;
            case "STAIR" -> HitKind.STAIR;
            case "TRANSITION" -> HitKind.TRANSITION;
            default -> HitKind.EMPTY;
        };
    }

    private static boolean selectableHit(@Nullable HitTarget hit) {
        return hit != null && hit.kind() != HitKind.EMPTY && hit.topologyRefId() > 0L && !"EMPTY".equals(hit.topologyRefKind());
    }

    private static boolean draggableHit(HitTarget hit) {
        return hit != null
                && (hit.kind() == HitKind.HANDLE || hit.kind() == HitKind.LABEL)
                && (hit.clusterId() > 0L || hit.handleRef().ownerId() > 0L);
    }

    private static boolean clusterSelection(HitTarget hit) {
        return hit.kind() == HitKind.LABEL || hit.handleRef().clusterLabel();
    }

    private static DungeonEditorHandleRef dragHandleRef(HitTarget hit) {
        if (hit.kind() == HitKind.HANDLE) {
            return hit.handleRef().toDungeonHandleRef();
        }
        return HandleTarget.clusterLabel(
                hit.topologyRefKind(),
                hit.topologyRefId(),
                hit.ownerId(),
                hit.clusterId()).toDungeonHandleRef();
    }

    private static boolean selectionToolSelected(String selectedTool) {
        return "Auswahl".equals(normalizeTool(selectedTool));
    }

    private static boolean boundaryToolSelected(String selectedTool) {
        return "Wand setzen".equals(selectedTool)
                || "Wand löschen".equals(selectedTool)
                || "Tür setzen".equals(selectedTool)
                || "Tür löschen".equals(selectedTool);
    }

    private static boolean corridorToolSelected(String selectedTool) {
        return "Korridor erstellen".equals(selectedTool) || "Korridor löschen".equals(selectedTool);
    }

    private static boolean roomPaintToolSelected(String selectedTool) {
        return "Raum malen".equals(selectedTool) || "Raum löschen".equals(selectedTool);
    }

    private static String normalizeTool(String selectedTool) {
        return selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
    }

    private static List<DungeonCellRef> touchingCells(DungeonCellRef start, DungeonCellRef end) {
        if (start == null || end == null || start.level() != end.level()) {
            return List.of();
        }
        if (start.r() == end.r()) {
            return horizontalTouchingCells(start, end);
        }
        if (start.q() == end.q()) {
            return verticalTouchingCells(start, end);
        }
        return List.of();
    }

    private static List<DungeonCellRef> horizontalTouchingCells(DungeonCellRef start, DungeonCellRef end) {
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        List<DungeonCellRef> result = new ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new DungeonCellRef(q, start.r() - 1, start.level()));
            result.add(new DungeonCellRef(q, start.r(), start.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCellRef> verticalTouchingCells(DungeonCellRef start, DungeonCellRef end) {
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        List<DungeonCellRef> result = new ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new DungeonCellRef(start.q() - 1, r, start.level()));
            result.add(new DungeonCellRef(start.q(), r, start.level()));
        }
        return List.copyOf(result);
    }

    private static DungeonTopologyElementKind toPublishedTopologyKind(String kind) {
        try {
            return DungeonTopologyElementKind.valueOf(kind);
        } catch (IllegalArgumentException ignored) {
            return DungeonTopologyElementKind.EMPTY;
        }
    }

    record Effect(
            ApplyDungeonEditorSessionUseCase.@Nullable SelectionData selection,
            boolean clearSelection,
            @Nullable DungeonEditorOperation previewOperation,
            boolean clearPreview,
            @Nullable DungeonEditorOperation applyOperation,
            int projectionLevelDelta,
            @Nullable String statusText
    ) {
        static Effect none() { return new Effect(null, false, null, false, null, 0, null); }
        static Effect preview(DungeonEditorOperation operation) { return new Effect(null, false, operation, false, null, 0, null); }
        static Effect apply(DungeonEditorOperation operation) { return new Effect(null, false, null, true, operation, 0, null); }
        static Effect applyWithStatus(DungeonEditorOperation operation, String statusText) { return new Effect(null, false, null, true, operation, 0, statusText); }
        static Effect select(ApplyDungeonEditorSessionUseCase.SelectionData selection) { return new Effect(selection, false, null, true, null, 0, null); }
        static Effect select(ApplyDungeonEditorSessionUseCase.SelectionData selection, String statusText) { return new Effect(selection, false, null, true, null, 0, statusText); }
        static Effect clearedSelection() { return new Effect(null, true, null, true, null, 0, null); }
        static Effect projectionLevel(int delta) { return new Effect(null, false, null, false, null, delta, null); }
        static Effect clearPreviewIfNeeded(boolean clearPreview) { return new Effect(null, false, null, clearPreview, null, 0, null); }
        boolean isNoop() {
            return !clearSelection && selection == null && previewOperation == null && !clearPreview
                    && applyOperation == null && projectionLevelDelta == 0 && statusText == null;
        }
    }

    enum HitKind { EMPTY, HANDLE, LABEL, BOUNDARY, ROOM, CORRIDOR, STAIR, TRANSITION }

    record CellTarget(int q, int r, int level) {
        static CellTarget empty() { return new CellTarget(0, 0, 0); }
        DungeonCellRef toDungeonCellRef() { return new DungeonCellRef(q, r, level); }
    }

    record HandleTarget(
            String kind,
            String topologyRefKind,
            long topologyRefId,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int orderIndex,
            CellTarget anchor,
            String direction
    ) {
        HandleTarget {
            kind = kind == null || kind.isBlank() ? "CLUSTER_LABEL" : kind;
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            orderIndex = Math.max(0, orderIndex);
            anchor = anchor == null ? CellTarget.empty() : anchor;
            direction = direction == null ? "" : direction;
        }
        static HandleTarget empty() { return new HandleTarget("CLUSTER_LABEL", "EMPTY", 0L, 0L, 0L, 0L, 0L, 0, CellTarget.empty(), ""); }
        static HandleTarget clusterLabel(String topologyRefKind, long topologyRefId, long ownerId, long clusterId) {
            return new HandleTarget("CLUSTER_LABEL", topologyRefKind, topologyRefId, ownerId, clusterId, 0L, 0L, 0, CellTarget.empty(), "");
        }
        boolean clusterLabel() { return "CLUSTER_LABEL".equals(kind); }
        DungeonEditorHandleRef toDungeonHandleRef() {
            return new DungeonEditorHandleRef(
                    DungeonEditorHandleKind.valueOf(kind),
                    new DungeonTopologyElementRef(toPublishedTopologyKind(topologyRefKind), topologyRefId),
                    ownerId,
                    clusterId,
                    corridorId,
                    roomId,
                    orderIndex,
                    anchor.toDungeonCellRef(),
                    direction);
        }
    }

    record BoundaryTarget(
            boolean present,
            String kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            CellTarget start,
            CellTarget end
    ) {
        BoundaryTarget {
            kind = kind == null || kind.isBlank() ? "WALL" : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind;
            topologyRefId = Math.max(0L, topologyRefId);
            start = start == null ? CellTarget.empty() : start;
            end = end == null ? CellTarget.empty() : end;
        }
        static BoundaryTarget empty() { return new BoundaryTarget(false, "WALL", 0L, 0L, "EMPTY", 0L, CellTarget.empty(), CellTarget.empty()); }
    }

    record HitTarget(
            HitKind kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            HandleTarget handleRef,
            BoundaryTarget boundaryTarget
    ) {
        HitTarget {
            kind = kind == null ? HitKind.EMPTY : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            handleRef = handleRef == null
                    ? HandleTarget.clusterLabel(topologyRefKind, topologyRefId, ownerId, clusterId)
                    : handleRef;
            boundaryTarget = boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget;
        }
        static HitTarget empty() { return new HitTarget(HitKind.EMPTY, 0L, 0L, "EMPTY", 0L, HandleTarget.empty(), BoundaryTarget.empty()); }
    }

    record PointerState(
            int q,
            int r,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            HitTarget hitTarget,
            VertexTarget vertexTarget,
            BoundaryTarget boundaryTarget
    ) {
        PointerState {
            hitTarget = hitTarget == null ? HitTarget.empty() : hitTarget;
            vertexTarget = vertexTarget == null ? VertexTarget.empty() : vertexTarget;
            boundaryTarget = boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget;
        }
    }

    record VertexTarget(boolean present, int q, int r, int level) {
        static VertexTarget empty() { return new VertexTarget(false, 0, 0, 0); }
    }

    private record PaintSession(int startQ, int startR, int endQ, int endR, int level, boolean deleteMode) {
        PaintSession withEnd(int nextEndQ, int nextEndR) { return new PaintSession(startQ, startR, nextEndQ, nextEndR, level, deleteMode); }
    }

    private record DragSession(
            ApplyDungeonEditorSessionUseCase.SelectionData selection,
            int pressQ,
            int pressR,
            int currentQ,
            int currentR,
            int pressLevel,
            int currentLevel
    ) {
        static DragSession start(ApplyDungeonEditorSessionUseCase.SelectionData selection, int pressQ, int pressR, int pressLevel) {
            return new DragSession(selection, pressQ, pressR, pressQ, pressR, pressLevel, pressLevel);
        }
        int deltaQ() { return currentQ - pressQ; }
        int deltaR() { return currentR - pressR; }
        int deltaLevel() { return currentLevel - pressLevel; }
        boolean moved() { return deltaQ() != 0 || deltaR() != 0 || deltaLevel() != 0; }
        DragSession withCurrentPointer(int nextQ, int nextR) { return new DragSession(selection, pressQ, pressR, nextQ, nextR, pressLevel, currentLevel); }
        DragSession withCurrentLevel(int nextLevel) { return new DragSession(selection, pressQ, pressR, currentQ, currentR, pressLevel, nextLevel); }
    }

    private enum BoundaryStretchOrientation {
        HORIZONTAL,
        VERTICAL;
        private static @Nullable BoundaryStretchOrientation from(BoundaryTarget boundaryTarget) {
            if (boundaryTarget == null || !boundaryTarget.present()) {
                return null;
            }
            if (boundaryTarget.start().q() == boundaryTarget.end().q()) {
                return VERTICAL;
            }
            if (boundaryTarget.start().r() == boundaryTarget.end().r()) {
                return HORIZONTAL;
            }
            return null;
        }
    }

    private record BoundaryStretchSession(
            ApplyDungeonEditorSessionUseCase.SelectionData selection,
            long clusterId,
            List<DungeonEdgeRef> sourceEdges,
            BoundaryStretchOrientation orientation,
            int pressQ,
            int pressR,
            int pressLevel,
            int currentQ,
            int currentR
    ) {
        BoundaryStretchSession {
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
            orientation = orientation == null ? BoundaryStretchOrientation.VERTICAL : orientation;
        }
        BoundaryStretchSession withCurrentPointer(int nextQ, int nextR) {
            return new BoundaryStretchSession(selection, clusterId, sourceEdges, orientation, pressQ, pressR, pressLevel, nextQ, nextR);
        }
        int deltaQ() { return orientation == BoundaryStretchOrientation.VERTICAL ? currentQ - pressQ : 0; }
        int deltaR() { return orientation == BoundaryStretchOrientation.HORIZONTAL ? currentR - pressR : 0; }
        int deltaLevel() { return 0; }
        boolean moved() { return deltaQ() != 0 || deltaR() != 0; }
    }

    private record BoundaryDraft(
            long clusterId,
            boolean deleteMode,
            VertexKey startVertex,
            VertexKey currentVertex,
            Set<EdgeKey> previewEdges
    ) {
        private BoundaryDraft { previewEdges = previewEdges == null ? Set.of() : Set.copyOf(previewEdges); }
    }

    private record CorridorDraft(PendingCorridorTarget start) { }

    private sealed interface PendingCorridorTarget permits PendingCorridorTarget.EndpointTarget {
        String targetKey();
        String displayLabel();
        ApplyDungeonEditorSessionUseCase.SelectionData selection();
        long deleteCorridorId();
        DungeonEditorOperation.CorridorEndpoint endpoint();

        record EndpointTarget(
                String targetKey,
                String displayLabel,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                long deleteCorridorId,
                DungeonEditorOperation.CorridorEndpoint endpoint
        ) implements PendingCorridorTarget { }
    }

    private record BoundaryRoomTouch(DungeonAreaSnapshot room, DungeonCellRef roomCell) { }

    private record PathResult(List<EdgeKey> routeEdges, Set<EdgeKey> committedEdges) {
        private PathResult {
            routeEdges = routeEdges == null ? List.of() : List.copyOf(routeEdges);
            committedEdges = committedEdges == null ? Set.of() : Set.copyOf(committedEdges);
        }
        static PathResult empty() { return new PathResult(List.of(), Set.of()); }
        boolean hasRoute() { return !routeEdges.isEmpty(); }
    }

    private record CellKey(int q, int r, int level) {
        CellKey neighbor(Direction direction) { return new CellKey(q + direction.deltaQ(), r + direction.deltaR(), level); }
    }

    private record VertexKey(int q, int r, int level) {
        private static final Comparator<VertexKey> ORDER = Comparator
                .comparingInt(VertexKey::level)
                .thenComparingInt(VertexKey::r)
                .thenComparingInt(VertexKey::q);
    }

    private record EdgeKey(VertexKey start, VertexKey end) {
        static EdgeKey from(DungeonEdgeRef edge) {
            return between(new VertexKey(edge.from().q(), edge.from().r(), edge.from().level()),
                    new VertexKey(edge.to().q(), edge.to().r(), edge.to().level()));
        }
        static EdgeKey between(VertexKey first, VertexKey second) {
            return VertexKey.ORDER.compare(first, second) <= 0 ? new EdgeKey(first, second) : new EdgeKey(second, first);
        }
        static EdgeKey sideOf(CellKey cell, Direction direction) {
            return switch (direction) {
                case NORTH -> between(new VertexKey(cell.q(), cell.r(), cell.level()), new VertexKey(cell.q() + 1, cell.r(), cell.level()));
                case EAST -> between(new VertexKey(cell.q() + 1, cell.r(), cell.level()), new VertexKey(cell.q() + 1, cell.r() + 1, cell.level()));
                case SOUTH -> between(new VertexKey(cell.q(), cell.r() + 1, cell.level()), new VertexKey(cell.q() + 1, cell.r() + 1, cell.level()));
                case WEST -> between(new VertexKey(cell.q(), cell.r(), cell.level()), new VertexKey(cell.q(), cell.r() + 1, cell.level()));
            };
        }
        boolean touches(VertexKey vertex) { return start.equals(vertex) || end.equals(vertex); }
        DungeonEdgeRef toEdgeRef() {
            return new DungeonEdgeRef(
                    new DungeonCellRef(start.q(), start.r(), start.level()),
                    new DungeonCellRef(end.q(), end.r(), end.level()));
        }
    }

    private enum Direction {
        NORTH(0, -1), EAST(1, 0), SOUTH(0, 1), WEST(-1, 0);
        private final int deltaQ;
        private final int deltaR;
        Direction(int deltaQ, int deltaR) { this.deltaQ = deltaQ; this.deltaR = deltaR; }
        int deltaQ() { return deltaQ; }
        int deltaR() { return deltaR; }
    }

    private static VertexKey vertexKey(VertexTarget vertex) { return new VertexKey(vertex.q(), vertex.r(), vertex.level()); }

    private static DungeonEditorOperation moveHandleOperation(DragSession session) {
        DungeonEditorHandleRef handleRef = session.selection().handleRef() == null
                ? new DungeonEditorHandleRef(
                DungeonEditorHandleKind.CLUSTER_LABEL,
                session.selection().topologyRef(),
                0L,
                session.selection().clusterId(),
                0L,
                0L,
                0,
                new DungeonCellRef(0, 0, 0),
                "")
                : session.selection().handleRef();
        return new DungeonEditorOperation.MoveEditorHandle(handleRef, session.deltaQ(), session.deltaR(), session.deltaLevel());
    }
}
