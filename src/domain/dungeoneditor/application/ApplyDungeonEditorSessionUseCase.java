package src.domain.dungeoneditor.application;

import java.util.List;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadQuery;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogRequest;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;

public final class ApplyDungeonEditorSessionUseCase {

    private final Function<DungeonMapCatalogRequest, DungeonMapCatalogResponse> catalog;
    private final Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
            new InterpretDungeonEditorMainViewInputUseCase();
    private DungeonEditorSession session = DungeonEditorSession.empty();

    public ApplyDungeonEditorSessionUseCase(
            Function<DungeonMapCatalogRequest, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadQuery, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.catalog = catalog;
        this.mutateAuthored = mutateAuthored;
        this.snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(catalog, mutateAuthored, loadAuthored);
    }

    public void primeSelectedMap(@Nullable DungeonMapId mapId) {
        if (mapId != null) {
            session = session.primeSelectedMap(mapId.value());
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
                toDomainMapId(session.selectedMap()),
                session.viewMode(),
                session.selectedTool(),
                session.projectionLevel(),
                DungeonEditorSessionBridge.toOverlayData(session.overlaySettings()),
                DungeonEditorSessionBridge.toSelectionData(session.selection()),
                DungeonEditorSessionBridge.toPreviewData(session.preview()),
                session.statusText()));
        session = session.withSelectedMap(toSelectedMap(snapshot.selectedMapId()))
                .withProjectionLevel(snapshot.projectionLevel());
        return snapshot;
    }

    private void clearTransientState(String nextStatusText) {
        session = session.clearTransientState(nextStatusText);
        mainViewInterpreter.clear();
    }

    private void selectMap(Command command) {
        session = session.withSelectedMap(toSelectedMap(command.mapId())).clearSelection();
        clearTransientState("");
    }

    private void createSelectedMap(Command command) {
        session = session.withSelectedMap(toSelectedMap(requireMutationMapId(
                catalog.apply(new DungeonMapCatalogRequest.CreateMap(command.mapName())))))
                .clearSelection();
        clearTransientState("Dungeon-Map erstellt.");
    }

    private void renameSelectedMap(Command command) {
        session = session.withSelectedMap(toSelectedMap(requireMutationMapId(catalog.apply(
                new DungeonMapCatalogRequest.RenameMap(
                        requireMapId(command.mapId()),
                        command.mapName())))))
                .withStatusText("Dungeon-Map umbenannt.");
    }

    private void deleteSelectedMap(Command command) {
        DungeonMapId deletedMapId = requireMutationMapId(catalog.apply(
                new DungeonMapCatalogRequest.DeleteMap(requireMapId(command.mapId()))));
        if (deletedMapId != null && deletedMapId.equals(toDomainMapId(session.selectedMap()))) {
            session = session.withSelectedMap(DungeonEditorSession.SelectedMap.none());
        }
        session = session.clearSelection();
        clearTransientState("Dungeon-Map gelöscht.");
    }

    private void setViewMode(Command command) {
        session = session.withViewMode(command.viewMode());
        clearTransientState("");
    }

    private void setTool(Command command) {
        session = session.withSelectedTool(command.selectedTool());
        clearTransientState("");
    }

    private void shiftProjectionLevel(Command command) {
        session = session.shiftProjectionLevel(command.projectionLevelDelta()).withStatusText("");
    }

    private void setOverlay(Command command) {
        session = session.withOverlaySettings(DungeonEditorSessionBridge.toSessionOverlay(command.overlaySettings()))
                .withStatusText("");
    }

    private void applyRoomNarration(RoomNarrationInput roomNarration) {
        if (roomNarration == null || roomNarration.roomId() <= 0L) {
            return;
        }
        DungeonOperationResult result = requireOperationResult(mutateAuthored.apply(
                new DungeonAuthoredMutationCommand.ApplyOperation(
                        requireMapId(session.selectedMap()),
                        new DungeonEditorOperation.SaveRoomNarration(
                                roomNarration.roomId(),
                                roomNarration.visualDescription(),
                                roomNarration.exits()))));
        session = session.clearPreview().withStatusText(statusFromMessages(result));
    }

    private void applyMainViewInput(MainViewInput mainViewInput) {
        MainViewInput input = mainViewInput == null ? MainViewInput.empty() : mainViewInput;
        DungeonSnapshot committedSnapshot = snapshotBuilder.loadCommittedSnapshot(toDomainMapId(session.selectedMap()));
        if (input.source() == MainViewInputSource.LEVEL_SCROLLED) {
            applyInteractionEffect(mainViewInterpreter.consume(
                    input,
                    committedSnapshot,
                    DungeonEditorSessionBridge.toSelectionData(session.selection()),
                    session.selectedTool(),
                    session.viewMode(),
                    session.projectionLevel()));
            return;
        }
        if (!session.selectedMap().present()
                || committedSnapshot == null
                || session.viewMode() != DungeonEditorSession.ViewMode.GRID) {
            return;
        }
        applyInteractionEffect(mainViewInterpreter.consume(
                input,
                committedSnapshot,
                DungeonEditorSessionBridge.toSelectionData(session.selection()),
                session.selectedTool(),
                session.viewMode(),
                session.projectionLevel()));
    }

    private void applyInteractionEffect(InterpretDungeonEditorMainViewInputUseCase.Effect effect) {
        if (effect == null) {
            return;
        }
        if (effect.projectionLevelDelta() != 0) {
            session = session.shiftProjectionLevel(effect.projectionLevelDelta());
        }
        if (effect.statusText() != null) {
            session = session.withStatusText(effect.statusText());
        }
        if (effect.clearSelection()) {
            session = session.clearSelection().clearPreview();
        } else if (effect.selection() != null) {
            session = session.withSelection(DungeonEditorSessionBridge.toSessionSelection(effect.selection()))
                    .clearPreview();
        }
        if (effect.clearPreview()) {
            session = session.clearPreview();
        } else if (effect.preview() != null) {
            session = session.withPreview(DungeonEditorSessionBridge.toSessionPreview(effect.preview()))
                    .withStatusText("");
        }
        if (effect.applyOperation() != null) {
            DungeonOperationResult result = requireOperationResult(mutateAuthored.apply(
                    new DungeonAuthoredMutationCommand.ApplyOperation(
                            requireMapId(session.selectedMap()),
                            effect.applyOperation())));
            session = session.clearPreview().withStatusText(statusFromMessages(result));
        }
    }

    private static DungeonMapId requireMutationMapId(@Nullable DungeonMapCatalogResponse response) {
        if (response instanceof DungeonMapCatalogResponse.MapMutation mutation) {
            return mutation.mapId();
        }
        throw new IllegalStateException("Dungeon-Katalog-Antwort enthielt keine Mutation.");
    }

    static @Nullable DungeonOperationResult requireOperationResult(@Nullable DungeonAuthoredMutationResult result) {
        if (result instanceof DungeonAuthoredMutationResult.Operation operation) {
            return operation.result();
        }
        return null;
    }

    private static DungeonMapId requireMapId(@Nullable DungeonMapId mapId) {
        if (mapId == null) {
            throw new IllegalArgumentException("Dungeon-Map-ID fehlt.");
        }
        return mapId;
    }

    private static DungeonMapId requireMapId(DungeonEditorSession.SelectedMap selectedMap) {
        DungeonMapId mapId = toDomainMapId(selectedMap);
        if (mapId == null) {
            throw new IllegalArgumentException("Dungeon-Map-ID fehlt.");
        }
        return mapId;
    }

    private static @Nullable DungeonMapId toDomainMapId(DungeonEditorSession.SelectedMap selectedMap) {
        return selectedMap == null || !selectedMap.present() ? null : new DungeonMapId(selectedMap.value());
    }

    private static DungeonEditorSession.SelectedMap toSelectedMap(@Nullable DungeonMapId mapId) {
        return mapId == null ? DungeonEditorSession.SelectedMap.none() : new DungeonEditorSession.SelectedMap(mapId.value());
    }

    static String statusFromMessages(@Nullable DungeonOperationResult result) {
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
            CorridorCreatePreviewData,
            CorridorDeletePreviewData,
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

    public sealed interface CorridorEndpointData permits CorridorDoorEndpointData, CorridorAnchorEndpointData { }

    public record CorridorDoorEndpointData(
            long roomId,
            long clusterId,
            DungeonCellRef anchor,
            String direction,
            DungeonTopologyElementRef topologyRef
    ) implements CorridorEndpointData {
        public CorridorDoorEndpointData {
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            anchor = anchor == null ? new DungeonCellRef(0, 0, 0) : anchor;
            direction = direction == null ? "" : direction;
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    public record CorridorAnchorEndpointData(
            long corridorId,
            DungeonCellRef anchor,
            DungeonTopologyElementRef topologyRef
    ) implements CorridorEndpointData {
        public CorridorAnchorEndpointData {
            corridorId = Math.max(0L, corridorId);
            anchor = anchor == null ? new DungeonCellRef(0, 0, 0) : anchor;
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    public record CorridorCreatePreviewData(
            CorridorEndpointData start,
            CorridorEndpointData end
    ) implements PreviewData { }

    public record CorridorDeletePreviewData(long corridorId) implements PreviewData {
        public CorridorDeletePreviewData {
            corridorId = Math.max(0L, corridorId);
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
            DungeonEditorSession.ViewMode viewMode,
            DungeonEditorSession.Tool selectedTool,
            int projectionLevelDelta,
            OverlayData overlaySettings,
            MainViewInput mainViewInput,
            RoomNarrationInput roomNarration
    ) {
        public Command {
            action = action == null ? Action.INTERPRET_MAIN_VIEW : action;
            mapName = mapName == null ? "" : mapName;
            viewMode = viewMode == null ? DungeonEditorSession.ViewMode.GRID : viewMode;
            selectedTool = selectedTool == null ? DungeonEditorSession.Tool.SELECT : selectedTool;
            overlaySettings = overlaySettings == null ? OverlayData.defaults() : overlaySettings;
            mainViewInput = mainViewInput == null ? MainViewInput.empty() : mainViewInput;
            roomNarration = roomNarration == null ? RoomNarrationInput.empty() : roomNarration;
        }
    }

    public record SnapshotData(
            List<DungeonMapSummary> maps,
            @Nullable DungeonMapId selectedMapId,
            DungeonEditorSession.ViewMode viewMode,
            DungeonEditorSession.Tool selectedTool,
            int projectionLevel,
            OverlayData overlaySettings,
            SelectionData selection,
            @Nullable SurfaceData surface,
            PreviewData preview,
            String statusText
    ) {
        public SnapshotData {
            maps = maps == null ? List.of() : List.copyOf(maps);
            viewMode = viewMode == null ? DungeonEditorSession.ViewMode.GRID : viewMode;
            selectedTool = selectedTool == null ? DungeonEditorSession.Tool.SELECT : selectedTool;
            overlaySettings = overlaySettings == null ? OverlayData.defaults() : overlaySettings;
            selection = selection == null ? SelectionData.empty() : selection;
            preview = preview == null ? PreviewData.none() : preview;
            statusText = statusText == null ? "" : statusText;
        }

        public static SnapshotData empty(String statusText) {
            return new SnapshotData(
                    List.of(),
                    null,
                    DungeonEditorSession.ViewMode.GRID,
                    DungeonEditorSession.Tool.SELECT,
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

final class DungeonEditorSessionBridge {

    private DungeonEditorSessionBridge() {
    }

    static ApplyDungeonEditorSessionUseCase.OverlayData toOverlayData(DungeonEditorSession.OverlaySettings overlay) {
        DungeonEditorSession.OverlaySettings safeOverlay = overlay == null
                ? DungeonEditorSession.OverlaySettings.defaults()
                : overlay;
        return new ApplyDungeonEditorSessionUseCase.OverlayData(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    static DungeonEditorSession.OverlaySettings toSessionOverlay(
            ApplyDungeonEditorSessionUseCase.OverlayData overlay
    ) {
        ApplyDungeonEditorSessionUseCase.OverlayData safeOverlay = overlay == null
                ? ApplyDungeonEditorSessionUseCase.OverlayData.defaults()
                : overlay;
        return new DungeonEditorSession.OverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    static ApplyDungeonEditorSessionUseCase.SelectionData toSelectionData(DungeonEditorSession.Selection selection) {
        DungeonEditorSession.Selection safeSelection = selection == null ? DungeonEditorSession.Selection.empty() : selection;
        return new ApplyDungeonEditorSessionUseCase.SelectionData(
                toDomainTopologyRef(safeSelection.topologyRef()),
                safeSelection.clusterId(),
                safeSelection.clusterSelection(),
                safeSelection.handleRef().present() ? toDomainHandleRef(safeSelection.handleRef()) : null);
    }

    static DungeonEditorSession.Selection toSessionSelection(ApplyDungeonEditorSessionUseCase.SelectionData selection) {
        ApplyDungeonEditorSessionUseCase.SelectionData safeSelection = selection == null
                ? ApplyDungeonEditorSessionUseCase.SelectionData.empty()
                : selection;
        return new DungeonEditorSession.Selection(
                toSessionTopologyRef(safeSelection.topologyRef()),
                safeSelection.clusterId(),
                safeSelection.clusterSelection(),
                safeSelection.handleRef() == null
                        ? DungeonEditorSession.HandleRef.empty()
                        : toSessionHandleRef(safeSelection.handleRef()));
    }

    static ApplyDungeonEditorSessionUseCase.PreviewData toPreviewData(DungeonEditorSession.Preview preview) {
        if (preview == null || preview instanceof DungeonEditorSession.NonePreview) {
            return ApplyDungeonEditorSessionUseCase.PreviewData.none();
        }
        return switch (preview) {
            case DungeonEditorSession.RoomRectanglePreview room ->
                    new ApplyDungeonEditorSessionUseCase.RoomRectanglePreviewData(
                            toDomainCell(room.start()),
                            toDomainCell(room.end()),
                            room.deleteMode());
            case DungeonEditorSession.ClusterBoundariesPreview boundaries ->
                    new ApplyDungeonEditorSessionUseCase.ClusterBoundariesPreviewData(
                            boundaries.clusterId(),
                            boundaries.edges().stream().map(DungeonEditorSessionBridge::toDomainEdge).toList(),
                            "DOOR".equals(boundaries.boundaryKind()) ? DungeonBoundaryKind.DOOR : DungeonBoundaryKind.WALL,
                            boundaries.deleteMode());
            case DungeonEditorSession.CorridorCreatePreview corridor ->
                    new ApplyDungeonEditorSessionUseCase.CorridorCreatePreviewData(
                            toPreviewEndpoint(corridor.start()),
                            toPreviewEndpoint(corridor.end()));
            case DungeonEditorSession.CorridorDeletePreview corridor ->
                    new ApplyDungeonEditorSessionUseCase.CorridorDeletePreviewData(corridor.corridorId());
            case DungeonEditorSession.MoveHandlePreview moveHandle ->
                    new ApplyDungeonEditorSessionUseCase.MoveHandlePreviewData(
                            toDomainHandleRef(moveHandle.handleRef()),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorSession.MoveBoundaryStretchPreview stretch ->
                    new ApplyDungeonEditorSessionUseCase.MoveBoundaryStretchPreviewData(
                            stretch.clusterId(),
                            stretch.sourceEdges().stream().map(DungeonEditorSessionBridge::toDomainEdge).toList(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case DungeonEditorSession.NonePreview ignored -> ApplyDungeonEditorSessionUseCase.PreviewData.none();
        };
    }

    static DungeonEditorSession.Preview toSessionPreview(ApplyDungeonEditorSessionUseCase.PreviewData preview) {
        if (preview == null || preview instanceof ApplyDungeonEditorSessionUseCase.NonePreviewData) {
            return DungeonEditorSession.Preview.none();
        }
        return switch (preview) {
            case ApplyDungeonEditorSessionUseCase.RoomRectanglePreviewData room ->
                    new DungeonEditorSession.RoomRectanglePreview(
                            toSessionCell(room.start()),
                            toSessionCell(room.end()),
                            room.deleteMode());
            case ApplyDungeonEditorSessionUseCase.ClusterBoundariesPreviewData boundaries ->
                    new DungeonEditorSession.ClusterBoundariesPreview(
                            boundaries.clusterId(),
                            boundaries.edges().stream().map(DungeonEditorSessionBridge::toSessionEdge).toList(),
                            boundaries.boundaryKind().name(),
                            boundaries.deleteMode());
            case ApplyDungeonEditorSessionUseCase.CorridorCreatePreviewData corridor ->
                    new DungeonEditorSession.CorridorCreatePreview(
                            toSessionEndpoint(corridor.start()),
                            toSessionEndpoint(corridor.end()));
            case ApplyDungeonEditorSessionUseCase.CorridorDeletePreviewData corridor ->
                    new DungeonEditorSession.CorridorDeletePreview(corridor.corridorId());
            case ApplyDungeonEditorSessionUseCase.MoveHandlePreviewData moveHandle ->
                    new DungeonEditorSession.MoveHandlePreview(
                            toSessionHandleRef(moveHandle.handleRef()),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case ApplyDungeonEditorSessionUseCase.MoveBoundaryStretchPreviewData stretch ->
                    new DungeonEditorSession.MoveBoundaryStretchPreview(
                            stretch.clusterId(),
                            stretch.sourceEdges().stream().map(DungeonEditorSessionBridge::toSessionEdge).toList(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case ApplyDungeonEditorSessionUseCase.NonePreviewData ignored -> DungeonEditorSession.Preview.none();
        };
    }

    static @Nullable DungeonEditorOperation toDungeonOperation(ApplyDungeonEditorSessionUseCase.PreviewData preview) {
        if (preview == null || preview instanceof ApplyDungeonEditorSessionUseCase.NonePreviewData) {
            return null;
        }
        return switch (preview) {
            case ApplyDungeonEditorSessionUseCase.RoomRectanglePreviewData room ->
                    room.deleteMode()
                            ? new DungeonEditorOperation.DeleteRoomRectangle(room.start(), room.end())
                            : new DungeonEditorOperation.PaintRoomRectangle(room.start(), room.end());
            case ApplyDungeonEditorSessionUseCase.ClusterBoundariesPreviewData boundaries ->
                    new DungeonEditorOperation.EditClusterBoundaries(
                            boundaries.clusterId(),
                            boundaries.edges(),
                            boundaries.boundaryKind(),
                            boundaries.deleteMode());
            case ApplyDungeonEditorSessionUseCase.CorridorCreatePreviewData corridor ->
                    new DungeonEditorOperation.CreateCorridor(
                            toDomainCorridorEndpoint(corridor.start()),
                            toDomainCorridorEndpoint(corridor.end()));
            case ApplyDungeonEditorSessionUseCase.CorridorDeletePreviewData corridor ->
                    new DungeonEditorOperation.DeleteCorridor(corridor.corridorId());
            case ApplyDungeonEditorSessionUseCase.MoveHandlePreviewData moveHandle ->
                    new DungeonEditorOperation.MoveEditorHandle(
                            moveHandle.handleRef(),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case ApplyDungeonEditorSessionUseCase.MoveBoundaryStretchPreviewData stretch ->
                    new DungeonEditorOperation.MoveBoundaryStretch(
                            stretch.clusterId(),
                            stretch.sourceEdges(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case ApplyDungeonEditorSessionUseCase.NonePreviewData ignored -> null;
        };
    }

    private static ApplyDungeonEditorSessionUseCase.CorridorEndpointData toPreviewEndpoint(
            DungeonEditorSession.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorSession.CorridorDoorEndpoint door ->
                    new ApplyDungeonEditorSessionUseCase.CorridorDoorEndpointData(
                            door.roomId(),
                            door.clusterId(),
                            toDomainCell(door.anchor()),
                            door.direction(),
                            toDomainTopologyRef(door.topologyRef()));
            case DungeonEditorSession.CorridorAnchorEndpoint anchor ->
                    new ApplyDungeonEditorSessionUseCase.CorridorAnchorEndpointData(
                            anchor.corridorId(),
                            toDomainCell(anchor.anchor()),
                            toDomainTopologyRef(anchor.topologyRef()));
        };
    }

    private static DungeonEditorSession.CorridorEndpoint toSessionEndpoint(
            ApplyDungeonEditorSessionUseCase.CorridorEndpointData endpoint
    ) {
        return switch (endpoint) {
            case ApplyDungeonEditorSessionUseCase.CorridorDoorEndpointData door ->
                    new DungeonEditorSession.CorridorDoorEndpoint(
                            door.roomId(),
                            door.clusterId(),
                            toSessionCell(door.anchor()),
                            door.direction(),
                            toSessionTopologyRef(door.topologyRef()));
            case ApplyDungeonEditorSessionUseCase.CorridorAnchorEndpointData anchor ->
                    new DungeonEditorSession.CorridorAnchorEndpoint(
                            anchor.corridorId(),
                            toSessionCell(anchor.anchor()),
                            toSessionTopologyRef(anchor.topologyRef()));
        };
    }

    private static DungeonEditorOperation.CorridorEndpoint toDomainCorridorEndpoint(
            ApplyDungeonEditorSessionUseCase.CorridorEndpointData endpoint
    ) {
        return switch (endpoint) {
            case ApplyDungeonEditorSessionUseCase.CorridorDoorEndpointData door ->
                    new DungeonEditorOperation.CorridorDoorEndpoint(
                            door.roomId(),
                            door.clusterId(),
                            door.anchor(),
                            door.direction(),
                            door.topologyRef());
            case ApplyDungeonEditorSessionUseCase.CorridorAnchorEndpointData anchor ->
                    new DungeonEditorOperation.CorridorAnchorEndpoint(
                            anchor.corridorId(),
                            anchor.anchor(),
                            anchor.topologyRef());
        };
    }

    private static DungeonTopologyElementRef toDomainTopologyRef(DungeonEditorSession.TopologyRef ref) {
        DungeonEditorSession.TopologyRef safeRef = ref == null ? DungeonEditorSession.TopologyRef.empty() : ref;
        try {
            return new DungeonTopologyElementRef(DungeonTopologyElementKind.valueOf(safeRef.kind()), safeRef.id());
        } catch (IllegalArgumentException ignored) {
            return DungeonTopologyElementRef.empty();
        }
    }

    private static DungeonEditorSession.TopologyRef toSessionTopologyRef(DungeonTopologyElementRef ref) {
        DungeonTopologyElementRef safeRef = ref == null ? DungeonTopologyElementRef.empty() : ref;
        return new DungeonEditorSession.TopologyRef(safeRef.kind().name(), safeRef.id());
    }

    private static DungeonCellRef toDomainCell(DungeonEditorSession.Cell cell) {
        DungeonEditorSession.Cell safeCell = cell == null ? DungeonEditorSession.Cell.empty() : cell;
        return new DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private static DungeonEditorSession.Cell toSessionCell(DungeonCellRef cell) {
        DungeonCellRef safeCell = cell == null ? new DungeonCellRef(0, 0, 0) : cell;
        return new DungeonEditorSession.Cell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private static DungeonEdgeRef toDomainEdge(DungeonEditorSession.Edge edge) {
        DungeonEditorSession.Edge safeEdge = edge == null
                ? new DungeonEditorSession.Edge(DungeonEditorSession.Cell.empty(), DungeonEditorSession.Cell.empty())
                : edge;
        return new DungeonEdgeRef(toDomainCell(safeEdge.from()), toDomainCell(safeEdge.to()));
    }

    private static DungeonEditorSession.Edge toSessionEdge(DungeonEdgeRef edge) {
        DungeonEdgeRef safeEdge = edge == null
                ? new DungeonEdgeRef(new DungeonCellRef(0, 0, 0), new DungeonCellRef(0, 0, 0))
                : edge;
        return new DungeonEditorSession.Edge(toSessionCell(safeEdge.from()), toSessionCell(safeEdge.to()));
    }

    private static DungeonEditorHandleRef toDomainHandleRef(DungeonEditorSession.HandleRef handleRef) {
        DungeonEditorSession.HandleRef safeHandle = handleRef == null ? DungeonEditorSession.HandleRef.empty() : handleRef;
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.valueOf(safeHandle.kind()),
                toDomainTopologyRef(safeHandle.topologyRef()),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.orderIndex(),
                toDomainCell(safeHandle.anchor()),
                safeHandle.direction());
    }

    private static DungeonEditorSession.HandleRef toSessionHandleRef(DungeonEditorHandleRef handleRef) {
        DungeonEditorHandleRef safeHandle = handleRef == null
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
        return new DungeonEditorSession.HandleRef(
                safeHandle.kind().name(),
                toSessionTopologyRef(safeHandle.topologyRef()),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.index(),
                toSessionCell(new DungeonCellRef(safeHandle.cell().q(), safeHandle.cell().r(), safeHandle.cell().level())),
                safeHandle.direction());
    }
}
