package src.domain.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeoneditor.application.ApplyDungeonEditorSessionUseCase;
import src.domain.dungeoneditor.published.ApplyDungeonEditorSessionCommand;
import src.domain.dungeoneditor.published.DungeonEditorCell;
import src.domain.dungeoneditor.published.DungeonEditorEdge;
import src.domain.dungeoneditor.published.DungeonEditorHandleRef;
import src.domain.dungeoneditor.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.DungeonEditorMapSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapSummary;
import src.domain.dungeoneditor.published.DungeonEditorModel;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorPreview;
import src.domain.dungeoneditor.published.DungeonEditorSurface;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorTopologyElementRef;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;
import src.domain.dungeoneditor.published.LoadDungeonEditorQuery;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;

public final class DungeonEditorApplicationService {

    private final ApplyDungeonEditorSessionUseCase applyDungeonEditorSessionUseCase;
    private final List<Consumer<DungeonEditorSnapshot>> editorListeners = new ArrayList<>();
    private final DungeonEditorModel editorModel = new DungeonEditorModel(
            this::currentEditorSnapshot,
            this::subscribeEditorListener);

    public DungeonEditorApplicationService(DungeonApplicationService dungeonApplicationService) {
        DungeonApplicationService dungeon = Objects.requireNonNull(dungeonApplicationService, "dungeonApplicationService");
        this.applyDungeonEditorSessionUseCase = new ApplyDungeonEditorSessionUseCase(
                dungeon::createMap,
                dungeon::renameMap,
                dungeon::deleteMap,
                dungeon::applyOperation,
                dungeon::searchMaps,
                dungeon::previewOperation,
                dungeon::describeSelection,
                dungeon::loadSnapshot);
    }

    public DungeonEditorModel loadEditor(LoadDungeonEditorQuery query) {
        DungeonEditorMapId requestedMapId = CommandTranslation.requestedMapId(query);
        if (requestedMapId != null) {
            applyDungeonEditorSessionUseCase.primeSelectedMap(CommandTranslation.toDomainMapId(requestedMapId));
        }
        return editorModel;
    }

    public DungeonEditorSnapshot applyEditorSession(ApplyDungeonEditorSessionCommand command) {
        applyDungeonEditorSessionUseCase.apply(CommandTranslation.toInternalCommand(command));
        DungeonEditorSnapshot snapshot = currentEditorSnapshot();
        notifyEditorListeners(snapshot);
        return snapshot;
    }

    private DungeonEditorSnapshot currentEditorSnapshot() {
        return SnapshotTranslation.toPublishedSnapshot(applyDungeonEditorSessionUseCase.snapshot());
    }

    private Runnable subscribeEditorListener(Consumer<DungeonEditorSnapshot> listener) {
        Consumer<DungeonEditorSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        editorListeners.add(safeListener);
        return () -> editorListeners.remove(safeListener);
    }

    private void notifyEditorListeners(DungeonEditorSnapshot snapshot) {
        List<Consumer<DungeonEditorSnapshot>> listeners = List.copyOf(editorListeners);
        for (Consumer<DungeonEditorSnapshot> listener : listeners) {
            listener.accept(snapshot);
        }
    }

    private static final class CommandTranslation {

        private CommandTranslation() {
        }

        private static @Nullable DungeonEditorMapId requestedMapId(@Nullable LoadDungeonEditorQuery query) {
            LoadDungeonEditorQuery effectiveQuery = query == null ? new LoadDungeonEditorQuery(null) : query;
            return effectiveQuery.mapId();
        }

        private static ApplyDungeonEditorSessionUseCase.Command toInternalCommand(
                @Nullable ApplyDungeonEditorSessionCommand command
        ) {
            ApplyDungeonEditorSessionCommand effective = command == null
                    ? new ApplyDungeonEditorSessionCommand(
                    ApplyDungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW,
                    null,
                    "",
                    DungeonEditorViewMode.GRID,
                    DungeonEditorTool.SELECT,
                    0,
                    DungeonEditorOverlaySettings.defaults(),
                    ApplyDungeonEditorSessionCommand.MainViewInput.empty(),
                    ApplyDungeonEditorSessionCommand.RoomNarrationInput.empty())
                    : command;
            return new ApplyDungeonEditorSessionUseCase.Command(
                    ApplyDungeonEditorSessionUseCase.Action.valueOf(effective.action().name()),
                    toDomainMapId(effective.mapId()),
                    effective.mapName(),
                    toSessionViewMode(effective.viewMode()),
                    toSessionTool(effective.selectedTool()),
                    effective.projectionLevelDelta(),
                    toInternalOverlay(effective.overlaySettings()),
                    toInternalMainViewInput(effective.mainViewInput()),
                    toInternalRoomNarration(effective.roomNarration()));
        }

        private static @Nullable DungeonMapId toDomainMapId(@Nullable DungeonEditorMapId mapId) {
            return mapId == null ? null : new DungeonMapId(mapId.value());
        }

        private static ApplyDungeonEditorSessionUseCase.OverlayData toInternalOverlay(
                @Nullable DungeonEditorOverlaySettings overlaySettings
        ) {
            DungeonEditorOverlaySettings safeOverlay = overlaySettings == null
                    ? DungeonEditorOverlaySettings.defaults()
                    : overlaySettings;
            return new ApplyDungeonEditorSessionUseCase.OverlayData(
                    safeOverlay.modeKey(),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    safeOverlay.selectedLevels());
        }

        private static ApplyDungeonEditorSessionUseCase.MainViewInput toInternalMainViewInput(
                ApplyDungeonEditorSessionCommand.@Nullable MainViewInput mainViewInput
        ) {
            ApplyDungeonEditorSessionCommand.MainViewInput safeInput = mainViewInput == null
                    ? ApplyDungeonEditorSessionCommand.MainViewInput.empty()
                    : mainViewInput;
            return new ApplyDungeonEditorSessionUseCase.MainViewInput(
                    ApplyDungeonEditorSessionUseCase.MainViewInputSource.valueOf(safeInput.source().name()),
                    safeInput.canvasX(),
                    safeInput.canvasY(),
                    safeInput.primaryButtonDown(),
                    safeInput.secondaryButtonDown(),
                    safeInput.hitRef(),
                    safeInput.levelDelta());
        }

        private static ApplyDungeonEditorSessionUseCase.RoomNarrationInput toInternalRoomNarration(
                ApplyDungeonEditorSessionCommand.@Nullable RoomNarrationInput roomNarration
        ) {
            ApplyDungeonEditorSessionCommand.RoomNarrationInput safeNarration = roomNarration == null
                    ? ApplyDungeonEditorSessionCommand.RoomNarrationInput.empty()
                    : roomNarration;
            return new ApplyDungeonEditorSessionUseCase.RoomNarrationInput(
                    safeNarration.roomId(),
                    safeNarration.visualDescription(),
                    safeNarration.exits().stream().map(CommandTranslation::toDomainRoomExit).toList());
        }

        private static DungeonEditorSession.ViewMode toSessionViewMode(@Nullable DungeonEditorViewMode viewMode) {
            return viewMode == DungeonEditorViewMode.GRAPH
                    ? DungeonEditorSession.ViewMode.GRAPH
                    : DungeonEditorSession.ViewMode.GRID;
        }

        private static DungeonEditorSession.Tool toSessionTool(@Nullable DungeonEditorTool tool) {
            return tool == null ? DungeonEditorSession.Tool.SELECT : DungeonEditorSession.Tool.valueOf(tool.name());
        }

        private static DungeonInspectorSnapshot.RoomExitNarration toDomainRoomExit(
                DungeonEditorInspectorSnapshot.@Nullable RoomExitNarration exit
        ) {
            DungeonEditorInspectorSnapshot.RoomExitNarration safeExit = exit == null
                    ? new DungeonEditorInspectorSnapshot.RoomExitNarration("", new DungeonEditorCell(0, 0, 0), "", "")
                    : exit;
            return new DungeonInspectorSnapshot.RoomExitNarration(
                    safeExit.label(),
                    new DungeonCellRef(safeExit.cell().q(), safeExit.cell().r(), safeExit.cell().level()),
                    safeExit.direction(),
                    safeExit.description());
        }
    }

    private static final class SnapshotTranslation {

        private SnapshotTranslation() {
        }

        private static DungeonEditorSnapshot toPublishedSnapshot(
                ApplyDungeonEditorSessionUseCase.@Nullable SnapshotData snapshot
        ) {
            ApplyDungeonEditorSessionUseCase.SnapshotData safeSnapshot = snapshot == null
                    ? ApplyDungeonEditorSessionUseCase.SnapshotData.empty("")
                    : snapshot;
            return new DungeonEditorSnapshot(
                    safeSnapshot.maps().stream().map(SnapshotTranslation::toPublishedMapSummary).toList(),
                    toPublishedMapId(safeSnapshot.selectedMapId()),
                    toPublishedViewMode(safeSnapshot.viewMode()),
                    toPublishedTool(safeSnapshot.selectedTool()),
                    safeSnapshot.projectionLevel(),
                    toPublishedOverlay(safeSnapshot.overlaySettings()),
                    toPublishedSelection(safeSnapshot.selection()),
                    toPublishedSurface(safeSnapshot.surface()),
                    toPublishedPreview(safeSnapshot.preview()),
                    ProjectionTranslation.projection(
                            safeSnapshot.surface(),
                            safeSnapshot.selection(),
                            safeSnapshot.preview()),
                    safeSnapshot.statusText());
        }

        private static DungeonEditorOverlaySettings toPublishedOverlay(
                ApplyDungeonEditorSessionUseCase.@Nullable OverlayData overlay
        ) {
            ApplyDungeonEditorSessionUseCase.OverlayData safeOverlay = overlay == null
                    ? ApplyDungeonEditorSessionUseCase.OverlayData.defaults()
                    : overlay;
            return new DungeonEditorOverlaySettings(
                    safeOverlay.modeKey(),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    safeOverlay.selectedLevels());
        }

        private static DungeonEditorSnapshot.Selection toPublishedSelection(
                ApplyDungeonEditorSessionUseCase.@Nullable SelectionData selection
        ) {
            ApplyDungeonEditorSessionUseCase.SelectionData safeSelection = selection == null
                    ? ApplyDungeonEditorSessionUseCase.SelectionData.empty()
                    : selection;
            return new DungeonEditorSnapshot.Selection(
                    toPublishedTopologyRef(safeSelection.topologyRef()),
                    safeSelection.clusterId(),
                    safeSelection.clusterSelection(),
                    safeSelection.handleRef() == null ? null : toPublishedHandleRefOrEmpty(safeSelection.handleRef()));
        }

        private static DungeonEditorPreview toPublishedPreview(
                ApplyDungeonEditorSessionUseCase.@Nullable PreviewData preview
        ) {
            if (preview == null || preview instanceof ApplyDungeonEditorSessionUseCase.NonePreviewData) {
                return DungeonEditorPreview.none();
            }
            return switch (preview) {
                case ApplyDungeonEditorSessionUseCase.RoomRectanglePreviewData room ->
                        new DungeonEditorPreview.RoomRectanglePreview(
                                toPublishedCell(room.start()),
                                toPublishedCell(room.end()),
                                room.deleteMode());
                case ApplyDungeonEditorSessionUseCase.ClusterBoundariesPreviewData boundaries ->
                        new DungeonEditorPreview.ClusterBoundariesPreview(
                                boundaries.clusterId(),
                                boundaries.edges().stream().map(SnapshotTranslation::toPublishedEdge).toList(),
                                boundaries.boundaryKind().name(),
                                boundaries.deleteMode());
                case ApplyDungeonEditorSessionUseCase.MoveHandlePreviewData moveHandle ->
                        new DungeonEditorPreview.MoveHandlePreview(
                                toPublishedHandleRefOrEmpty(moveHandle.handleRef()),
                                moveHandle.deltaQ(),
                                moveHandle.deltaR(),
                                moveHandle.deltaLevel());
                case ApplyDungeonEditorSessionUseCase.MoveBoundaryStretchPreviewData stretch ->
                        new DungeonEditorPreview.MoveBoundaryStretchPreview(
                                stretch.clusterId(),
                                stretch.sourceEdges().stream().map(SnapshotTranslation::toPublishedEdge).toList(),
                                stretch.deltaQ(),
                                stretch.deltaR(),
                                stretch.deltaLevel());
                case ApplyDungeonEditorSessionUseCase.CorridorCreatePreviewData ignored -> DungeonEditorPreview.none();
                case ApplyDungeonEditorSessionUseCase.CorridorDeletePreviewData ignored -> DungeonEditorPreview.none();
                case ApplyDungeonEditorSessionUseCase.NonePreviewData ignored -> DungeonEditorPreview.none();
            };
        }

        private static DungeonEditorViewMode toPublishedViewMode(DungeonEditorSession.@Nullable ViewMode viewMode) {
            return viewMode == DungeonEditorSession.ViewMode.GRAPH
                    ? DungeonEditorViewMode.GRAPH
                    : DungeonEditorViewMode.GRID;
        }

        private static DungeonEditorTool toPublishedTool(DungeonEditorSession.@Nullable Tool tool) {
            return tool == null ? DungeonEditorTool.SELECT : DungeonEditorTool.valueOf(tool.name());
        }

        private static DungeonEditorMapSummary toPublishedMapSummary(@Nullable DungeonMapSummary map) {
            DungeonMapSummary safeMap = map == null
                    ? new DungeonMapSummary(new DungeonMapId(1L), "Dungeon Map", 0L)
                    : map;
            return new DungeonEditorMapSummary(
                    new DungeonEditorMapId(safeMap.mapId().value()),
                    safeMap.mapName(),
                    safeMap.revision());
        }

        private static @Nullable DungeonEditorMapId toPublishedMapId(@Nullable DungeonMapId mapId) {
            return mapId == null ? null : new DungeonEditorMapId(mapId.value());
        }

        private static @Nullable DungeonEditorSurface toPublishedSurface(
                ApplyDungeonEditorSessionUseCase.@Nullable SurfaceData surface
        ) {
            if (surface == null) {
                return null;
            }
            return new DungeonEditorSurface(
                    surface.mapName(),
                    surface.revision(),
                    toPublishedMap(surface.map()),
                    surface.previewMap() == null ? null : toPublishedMap(surface.previewMap()),
                    toPublishedInspector(surface.inspector()));
        }

        private static DungeonEditorMapSnapshot toPublishedMap(@Nullable DungeonMapSnapshot map) {
            DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
            return new DungeonEditorMapSnapshot(
                    safeMap.topology().name(),
                    safeMap.width(),
                    safeMap.height(),
                    safeMap.areas().stream().map(SnapshotTranslation::toPublishedArea).toList(),
                    safeMap.boundaries().stream().map(SnapshotTranslation::toPublishedBoundary).toList(),
                    safeMap.features().stream().map(SnapshotTranslation::toPublishedFeature).toList(),
                    safeMap.editorHandles().stream().map(SnapshotTranslation::toPublishedEditorHandle).toList());
        }

        private static DungeonEditorMapSnapshot.Area toPublishedArea(@Nullable DungeonAreaSnapshot area) {
            DungeonAreaSnapshot safeArea = area == null ? null : area;
            if (safeArea == null) {
                return new DungeonEditorMapSnapshot.Area("ROOM", 1L, "ROOM", List.of());
            }
            return new DungeonEditorMapSnapshot.Area(
                    safeArea.kind().name(),
                    safeArea.id(),
                    safeArea.label(),
                    safeArea.cells().stream().map(SnapshotTranslation::toPublishedCell).toList());
        }

        private static DungeonEditorMapSnapshot.Boundary toPublishedBoundary(@Nullable DungeonBoundarySnapshot boundary) {
            DungeonBoundarySnapshot safeBoundary = boundary == null ? null : boundary;
            if (safeBoundary == null) {
                return new DungeonEditorMapSnapshot.Boundary(
                        "boundary",
                        1L,
                        "boundary",
                        new DungeonEditorEdge(new DungeonEditorCell(0, 0, 0), new DungeonEditorCell(0, 0, 0)),
                        DungeonEditorTopologyElementRef.empty());
            }
            return new DungeonEditorMapSnapshot.Boundary(
                    safeBoundary.kind(),
                    safeBoundary.id(),
                    safeBoundary.label(),
                    toPublishedEdge(safeBoundary.edge()),
                    toPublishedTopologyRef(safeBoundary.topologyRef()));
        }

        private static DungeonEditorMapSnapshot.Feature toPublishedFeature(@Nullable DungeonFeatureSnapshot feature) {
            DungeonFeatureSnapshot safeFeature = feature == null ? null : feature;
            if (safeFeature == null) {
                return new DungeonEditorMapSnapshot.Feature("STAIR", 1L, "STAIR", List.of(), "", "");
            }
            return new DungeonEditorMapSnapshot.Feature(
                    safeFeature.kind().name(),
                    safeFeature.id(),
                    safeFeature.label(),
                    safeFeature.cells().stream().map(SnapshotTranslation::toPublishedCell).toList(),
                    safeFeature.description(),
                    safeFeature.destinationLabel());
        }

        private static DungeonEditorMapSnapshot.EditorHandle toPublishedEditorHandle(
                @Nullable DungeonEditorHandleSnapshot handle
        ) {
            DungeonEditorHandleSnapshot safeHandle = handle == null ? null : handle;
            if (safeHandle == null) {
                return new DungeonEditorMapSnapshot.EditorHandle(
                        DungeonEditorHandleRef.empty(),
                        "CLUSTER_LABEL",
                        new DungeonEditorCell(0, 0, 0));
            }
            return new DungeonEditorMapSnapshot.EditorHandle(
                    toPublishedHandleRefOrEmpty(safeHandle.ref()),
                    safeHandle.label(),
                    toPublishedCell(safeHandle.cell()));
        }

        private static @Nullable DungeonEditorInspectorSnapshot toPublishedInspector(
                @Nullable DungeonInspectorSnapshot inspector
        ) {
            if (inspector == null) {
                return null;
            }
            return new DungeonEditorInspectorSnapshot(
                    inspector.title(),
                    inspector.summary(),
                    inspector.facts(),
                    inspector.roomNarrations().stream().map(SnapshotTranslation::toPublishedRoomNarrationCard).toList());
        }

        private static DungeonEditorInspectorSnapshot.RoomNarrationCard toPublishedRoomNarrationCard(
                DungeonInspectorSnapshot.@Nullable RoomNarrationCard card
        ) {
            DungeonInspectorSnapshot.RoomNarrationCard safeCard = card == null
                    ? new DungeonInspectorSnapshot.RoomNarrationCard(0L, "Raum", "", List.of())
                    : card;
            return new DungeonEditorInspectorSnapshot.RoomNarrationCard(
                    safeCard.roomId(),
                    safeCard.roomName(),
                    safeCard.visualDescription(),
                    safeCard.exits().stream().map(SnapshotTranslation::toPublishedRoomExit).toList());
        }

        private static DungeonEditorInspectorSnapshot.RoomExitNarration toPublishedRoomExit(
                DungeonInspectorSnapshot.@Nullable RoomExitNarration exit
        ) {
            DungeonInspectorSnapshot.RoomExitNarration safeExit = exit == null
                    ? new DungeonInspectorSnapshot.RoomExitNarration("", new DungeonCellRef(0, 0, 0), "", "")
                    : exit;
            return new DungeonEditorInspectorSnapshot.RoomExitNarration(
                    safeExit.label(),
                    toPublishedCell(safeExit.cell()),
                    safeExit.direction(),
                    safeExit.description());
        }

        private static DungeonEditorTopologyElementRef toPublishedTopologyRef(
                src.domain.dungeon.published.@Nullable DungeonTopologyElementRef ref
        ) {
            return ref == null
                    ? DungeonEditorTopologyElementRef.empty()
                    : new DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
        }

        private static DungeonEditorHandleRef toPublishedHandleRefOrEmpty(
                src.domain.dungeon.published.@Nullable DungeonEditorHandleRef handleRef
        ) {
            if (handleRef == null) {
                return DungeonEditorHandleRef.empty();
            }
            return new DungeonEditorHandleRef(
                    handleRef.kind().name(),
                    toPublishedTopologyRef(handleRef.topologyRef()),
                    handleRef.ownerId(),
                    handleRef.clusterId(),
                    handleRef.corridorId(),
                    handleRef.roomId(),
                    handleRef.index(),
                    toPublishedCell(handleRef.cell()),
                    handleRef.direction());
        }

        private static DungeonEditorCell toPublishedCell(@Nullable DungeonCellRef cell) {
            return cell == null ? new DungeonEditorCell(0, 0, 0) : new DungeonEditorCell(cell.q(), cell.r(), cell.level());
        }

        private static DungeonEditorEdge toPublishedEdge(src.domain.dungeon.published.@Nullable DungeonEdgeRef edge) {
            if (edge == null) {
                return new DungeonEditorEdge(new DungeonEditorCell(0, 0, 0), new DungeonEditorCell(0, 0, 0));
            }
            return new DungeonEditorEdge(toPublishedCell(edge.from()), toPublishedCell(edge.to()));
        }
    }

    private static final class ProjectionTranslation {

        private ProjectionTranslation() {
        }

        private static @Nullable DungeonEditorMapProjectionSnapshot projection(
                ApplyDungeonEditorSessionUseCase.@Nullable SurfaceData surface,
                ApplyDungeonEditorSessionUseCase.@Nullable SelectionData selection,
                ApplyDungeonEditorSessionUseCase.@Nullable PreviewData preview
        ) {
            if (surface == null) {
                return null;
            }
            ApplyDungeonEditorSessionUseCase.SelectionData safeSelection = selection == null
                    ? ApplyDungeonEditorSessionUseCase.SelectionData.empty()
                    : selection;
            ApplyDungeonEditorSessionUseCase.PreviewData safePreview = preview == null
                    ? ApplyDungeonEditorSessionUseCase.PreviewData.none()
                    : preview;
            ProjectionAccumulator projection = ProjectionAssembler.assemble(surface, safeSelection, safePreview);
            DungeonMapSnapshot map = surface.map();
            return new DungeonEditorMapProjectionSnapshot(
                    surface.mapName(),
                    ProjectionSupport.topology(map.topology()),
                    map.width(),
                    map.height(),
                    projection.cells(),
                    projection.edges(),
                    projection.labels(),
                    projection.markers(),
                    projection.graphNodes(),
                    projection.graphLinks(),
                    null);
        }
    }

    private static final class ProjectionAssembler {

        private ProjectionAssembler() {
        }

        private static ProjectionAccumulator assemble(
                ApplyDungeonEditorSessionUseCase.SurfaceData surface,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ApplyDungeonEditorSessionUseCase.PreviewData preview
        ) {
            ProjectionAccumulator projection = new ProjectionAccumulator(
                    new ArrayList<>(),
                    new ArrayList<>(),
                    new ArrayList<>(),
                    new ArrayList<>(),
                    new ArrayList<>(),
                    new ArrayList<>());
            DungeonMapSnapshot map = surface.map();
            renderAreas(map, selection, projection);
            renderClusterLabels(map, selection, projection.labels());
            addPreviewAndBoundaries(map, selection, preview, surface.previewMap(), projection);
            renderFeatures(map, selection, projection);
            renderHandles(map, selection, preview, projection.markers());
            addPreviewMapDiff(map, selection, preview, surface.previewMap(), projection);
            addFallbackGraphLinks(projection.graphNodes(), projection.graphLinks());
            return projection;
        }

        private static void renderAreas(
                DungeonMapSnapshot map,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ProjectionAccumulator projection
        ) {
            for (DungeonAreaSnapshot area : map.areas()) {
                boolean selected = ProjectionSupport.selectedArea(area, selection);
                List<DungeonEditorMapProjectionSnapshot.CellProjection> areaCells = area.cells().stream()
                        .map(cell -> ProjectionSupport.cell(area, cell, selected, false, 0, 0, 0))
                        .toList();
                projection.cells().addAll(areaCells);
                if (areaCells.isEmpty()) {
                    continue;
                }
                CellCenter center = ProjectionSupport.centerOf(areaCells);
                projection.graphNodes().add(new DungeonEditorMapProjectionSnapshot.GraphNodeProjection(
                        area.id(),
                        area.clusterId(),
                        area.label(),
                        center.q(),
                        center.r(),
                        selected));
            }
        }

        private static void renderClusterLabels(
                DungeonMapSnapshot map,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels
        ) {
            List<Long> renderedClusterIds = new ArrayList<>();
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                if (handle.ref().kind() != DungeonEditorHandleKind.CLUSTER_LABEL) {
                    continue;
                }
                long clusterId = handle.ref().clusterId();
                if (clusterId <= 0L || renderedClusterIds.contains(clusterId)) {
                    continue;
                }
                renderedClusterIds.add(clusterId);
                labels.add(ProjectionSupport.clusterLabel(
                        handle,
                        ProjectionSupport.selectedClusterLabel(handle, selection),
                        false,
                        0,
                        0,
                        0));
            }
        }

        private static void addPreviewAndBoundaries(
                DungeonMapSnapshot map,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ApplyDungeonEditorSessionUseCase.PreviewData preview,
                @Nullable DungeonMapSnapshot previewMap,
                ProjectionAccumulator projection
        ) {
            ProjectionPreviewAssembler.addEditorPreview(
                    projection.cells(),
                    projection.edges(),
                    projection.labels(),
                    map.areas(),
                    map.boundaries(),
                    map.editorHandles(),
                    selection,
                    preview,
                    previewMap);
            for (DungeonBoundarySnapshot boundary : map.boundaries()) {
                if (boundary.edge() == null || boundary.edge().from() == null || boundary.edge().to() == null) {
                    continue;
                }
                projection.edges().add(ProjectionSupport.edge(
                        boundary,
                        0,
                        0,
                        0,
                        false,
                        ProjectionSupport.selectedBoundary(boundary, selection)));
            }
        }

        private static void addPreviewMapDiff(
                DungeonMapSnapshot map,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ApplyDungeonEditorSessionUseCase.PreviewData preview,
                @Nullable DungeonMapSnapshot previewMap,
                ProjectionAccumulator projection
        ) {
            if (!(preview instanceof ApplyDungeonEditorSessionUseCase.NonePreviewData) || previewMap == null) {
                return;
            }
            ProjectionPreviewAssembler.addPreviewAreaDiff(
                    projection.cells(),
                    projection.labels(),
                    map.areas(),
                    previewMap.areas(),
                    selection);
            ProjectionPreviewAssembler.addPreviewBoundaryDiff(
                    projection.edges(),
                    map.boundaries(),
                    previewMap.boundaries(),
                    selection);
            ProjectionPreviewAssembler.addPreviewHandleDiff(
                    projection.markers(),
                    map.editorHandles(),
                    previewMap.editorHandles(),
                    selection);
        }

        private static void renderFeatures(
                DungeonMapSnapshot map,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ProjectionAccumulator projection
        ) {
            for (DungeonFeatureSnapshot feature : map.features()) {
                boolean selected = ProjectionSupport.selectedFeature(feature, selection);
                List<DungeonEditorMapProjectionSnapshot.CellProjection> featureCells = feature.cells().stream()
                        .map(cell -> ProjectionSupport.featureCell(feature, cell, selected))
                        .toList();
                projection.cells().addAll(featureCells);
                if (featureCells.isEmpty()) {
                    continue;
                }
                CellCenter center = ProjectionSupport.centerOf(featureCells);
                projection.labels().add(new DungeonEditorMapProjectionSnapshot.LabelProjection(
                        feature.label(),
                        center.q(),
                        center.r(),
                        featureCells.getFirst().level(),
                        feature.id(),
                        0L,
                        ProjectionSupport.safeTopologyRef(feature.topologyRef()),
                        selected,
                        false));
                projection.markers().add(ProjectionSupport.featureMarker(
                        feature,
                        center,
                        featureCells.getFirst().level(),
                        selected));
            }
        }

        private static void renderHandles(
                DungeonMapSnapshot map,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ApplyDungeonEditorSessionUseCase.PreviewData preview,
                List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers
        ) {
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                if (handle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL) {
                    continue;
                }
                markers.add(ProjectionSupport.handleMarker(handle, selection, false));
            }
            ProjectionPreviewAssembler.addHandleMovePreview(markers, preview);
        }

        private static void addFallbackGraphLinks(
                List<DungeonEditorMapProjectionSnapshot.GraphNodeProjection> graphNodes,
                List<DungeonEditorMapProjectionSnapshot.GraphLinkProjection> graphLinks
        ) {
            if (!graphLinks.isEmpty() || graphNodes.size() <= 1) {
                return;
            }
            for (int index = 1; index < graphNodes.size(); index++) {
                graphLinks.add(new DungeonEditorMapProjectionSnapshot.GraphLinkProjection(
                        graphNodes.get(index - 1).id(),
                        graphNodes.get(index).id(),
                        false));
            }
        }
    }

    private static final class ProjectionPreviewAssembler {

        private ProjectionPreviewAssembler() {
        }

        private static void addEditorPreview(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                List<DungeonAreaSnapshot> areas,
                List<DungeonBoundarySnapshot> boundaries,
                List<DungeonEditorHandleSnapshot> handles,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ApplyDungeonEditorSessionUseCase.PreviewData preview,
                @Nullable DungeonMapSnapshot previewMap
        ) {
            if (preview instanceof ApplyDungeonEditorSessionUseCase.MoveHandlePreviewData movePreview) {
                addClusterMovePreview(cells, edges, labels, areas, boundaries, handles, selection, movePreview);
            } else if (preview instanceof ApplyDungeonEditorSessionUseCase.RoomRectanglePreviewData roomRectangle) {
                addRoomRectanglePreview(cells, roomRectangle);
            } else if (preview instanceof ApplyDungeonEditorSessionUseCase.ClusterBoundariesPreviewData boundaryEdges) {
                addBoundaryEdgesPreview(edges, boundaryEdges);
            } else if (preview instanceof ApplyDungeonEditorSessionUseCase.MoveBoundaryStretchPreviewData boundaryStretchMove) {
                addBoundaryStretchPreview(cells, edges, labels, selection, previewMap, boundaryStretchMove);
            }
        }

        private static void addBoundaryStretchPreview(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                @Nullable DungeonMapSnapshot previewMap,
                ApplyDungeonEditorSessionUseCase.MoveBoundaryStretchPreviewData movePreview
        ) {
            if (previewMap == null) {
                return;
            }
            List<DungeonAreaSnapshot> previewAreas = previewMap.areas().stream()
                    .filter(area -> area.kind() == src.domain.dungeon.published.DungeonAreaKind.ROOM
                            && area.clusterId() == movePreview.clusterId())
                    .toList();
            if (previewAreas.isEmpty()) {
                return;
            }
            List<DungeonCellRef> previewClusterCells = previewAreas.stream()
                    .flatMap(area -> area.cells().stream())
                    .toList();
            for (DungeonAreaSnapshot area : previewAreas) {
                area.cells().stream()
                        .map(cell -> ProjectionSupport.cell(
                                area,
                                cell,
                                ProjectionSupport.selectedArea(area, selection),
                                true,
                                0,
                                0,
                                0))
                        .forEach(cells::add);
            }
            DungeonEditorHandleSnapshot previewHandle =
                    ProjectionSupport.clusterLabelHandle(previewMap.editorHandles(), movePreview.clusterId());
            if (previewHandle != null) {
                labels.add(ProjectionSupport.clusterLabel(previewHandle, true, true, 0, 0, 0));
            }
            for (DungeonBoundarySnapshot boundary : previewMap.boundaries()) {
                if (boundary.edge() == null
                        || boundary.edge().from() == null
                        || boundary.edge().to() == null
                        || !ProjectionSupport.edgeTouchesAnyCell(boundary.edge(), previewClusterCells)) {
                    continue;
                }
                edges.add(ProjectionSupport.edge(boundary, 0, 0, 0, true, false));
            }
        }

        private static void addPreviewAreaDiff(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                List<DungeonAreaSnapshot> committedAreas,
                List<DungeonAreaSnapshot> previewAreas,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
        ) {
            Map<String, DungeonAreaSnapshot> committedByTopology = ProjectionSupport.indexAreas(committedAreas);
            for (DungeonAreaSnapshot previewArea : previewAreas) {
                DungeonAreaSnapshot committedArea = committedByTopology.remove(
                        ProjectionSupport.topologyKey(previewArea.topologyRef()));
                if (previewArea.equals(committedArea)) {
                    continue;
                }
                addPreviewArea(cells, labels, previewArea, selection, false);
            }
            for (DungeonAreaSnapshot removedArea : committedByTopology.values()) {
                addPreviewArea(cells, labels, removedArea, selection, true);
            }
        }

        private static void addPreviewArea(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                DungeonAreaSnapshot area,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                boolean destructive
        ) {
            boolean selected = ProjectionSupport.selectedArea(area, selection);
            List<DungeonEditorMapProjectionSnapshot.CellProjection> previewCells = area.cells().stream()
                    .map(cell -> new DungeonEditorMapProjectionSnapshot.CellProjection(
                            cell.q(),
                            cell.r(),
                            cell.level(),
                            area.label(),
                            area.kind() == src.domain.dungeon.published.DungeonAreaKind.CORRIDOR
                                    ? DungeonEditorMapProjectionSnapshot.CellKind.CORRIDOR
                                    : DungeonEditorMapProjectionSnapshot.CellKind.ROOM,
                            area.id(),
                            area.clusterId(),
                            ProjectionSupport.safeTopologyRef(area.topologyRef()),
                            selected,
                            false,
                            true,
                            destructive))
                    .toList();
            cells.addAll(previewCells);
            if (previewCells.isEmpty()) {
                return;
            }
            CellCenter center = ProjectionSupport.centerOf(previewCells);
            labels.add(new DungeonEditorMapProjectionSnapshot.LabelProjection(
                    area.label(),
                    center.q(),
                    center.r(),
                    previewCells.getFirst().level(),
                    area.id(),
                    area.clusterId(),
                    ProjectionSupport.safeTopologyRef(area.topologyRef()),
                    selected,
                    true));
        }

        private static void addPreviewBoundaryDiff(
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonBoundarySnapshot> committedBoundaries,
                List<DungeonBoundarySnapshot> previewBoundaries,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
        ) {
            Map<String, DungeonBoundarySnapshot> committedByTopology = ProjectionSupport.indexBoundaries(committedBoundaries);
            for (DungeonBoundarySnapshot previewBoundary : previewBoundaries) {
                DungeonBoundarySnapshot committedBoundary = committedByTopology.remove(
                        ProjectionSupport.topologyKey(previewBoundary.topologyRef()));
                if (previewBoundary.equals(committedBoundary)) {
                    continue;
                }
                edges.add(ProjectionSupport.edge(
                        previewBoundary,
                        0,
                        0,
                        0,
                        true,
                        ProjectionSupport.selectedBoundary(previewBoundary, selection)));
            }
            for (DungeonBoundarySnapshot removedBoundary : committedByTopology.values()) {
                edges.add(ProjectionSupport.edge(
                        removedBoundary,
                        0,
                        0,
                        0,
                        true,
                        ProjectionSupport.selectedBoundary(removedBoundary, selection)));
            }
        }

        private static void addPreviewHandleDiff(
                List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers,
                List<DungeonEditorHandleSnapshot> committedHandles,
                List<DungeonEditorHandleSnapshot> previewHandles,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
        ) {
            Map<String, DungeonEditorHandleSnapshot> committedByHandle = ProjectionSupport.indexHandles(committedHandles);
            for (DungeonEditorHandleSnapshot previewHandle : previewHandles) {
                if (previewHandle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL) {
                    continue;
                }
                DungeonEditorHandleSnapshot committedHandle = committedByHandle.remove(
                        ProjectionSupport.handleKey(previewHandle.ref()));
                if (previewHandle.equals(committedHandle)) {
                    continue;
                }
                markers.add(ProjectionSupport.handleMarker(previewHandle, selection, true));
            }
            for (DungeonEditorHandleSnapshot removedHandle : committedByHandle.values()) {
                if (removedHandle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL) {
                    continue;
                }
                markers.add(ProjectionSupport.handleMarker(removedHandle, selection, true));
            }
        }

        private static void addRoomRectanglePreview(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                ApplyDungeonEditorSessionUseCase.RoomRectanglePreviewData roomRectangle
        ) {
            int minQ = Math.min(roomRectangle.start().q(), roomRectangle.end().q());
            int maxQ = Math.max(roomRectangle.start().q(), roomRectangle.end().q());
            int minR = Math.min(roomRectangle.start().r(), roomRectangle.end().r());
            int maxR = Math.max(roomRectangle.start().r(), roomRectangle.end().r());
            for (int q = minQ; q <= maxQ; q++) {
                for (int r = minR; r <= maxR; r++) {
                    cells.add(new DungeonEditorMapProjectionSnapshot.CellProjection(
                            q,
                            r,
                            roomRectangle.start().level(),
                            roomRectangle.deleteMode() ? "Delete preview" : "Paint preview",
                            DungeonEditorMapProjectionSnapshot.CellKind.ROOM,
                            0L,
                            0L,
                            DungeonEditorTopologyElementRef.empty(),
                            false,
                            false,
                            true,
                            roomRectangle.deleteMode()));
                }
            }
        }

        private static void addClusterMovePreview(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                List<DungeonAreaSnapshot> areas,
                List<DungeonBoundarySnapshot> boundaries,
                List<DungeonEditorHandleSnapshot> handles,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ApplyDungeonEditorSessionUseCase.MoveHandlePreviewData movePreview
        ) {
            if (movePreview.handleRef().kind() != DungeonEditorHandleKind.CLUSTER_LABEL) {
                return;
            }
            List<DungeonCellRef> draggedCells = new ArrayList<>();
            for (DungeonAreaSnapshot area : areas) {
                if (!ProjectionSupport.draggedClusterArea(area, selection, movePreview)) {
                    continue;
                }
                List<DungeonEditorMapProjectionSnapshot.CellProjection> previewCells = area.cells().stream()
                        .map(cell -> ProjectionSupport.cell(
                                area,
                                cell,
                                true,
                                true,
                                movePreview.deltaQ(),
                                movePreview.deltaR(),
                                movePreview.deltaLevel()))
                        .toList();
                cells.addAll(previewCells);
                draggedCells.addAll(area.cells());
            }
            DungeonEditorHandleSnapshot clusterLabelHandle =
                    ProjectionSupport.clusterLabelHandle(handles, movePreview.handleRef().clusterId());
            if (clusterLabelHandle != null) {
                labels.add(ProjectionSupport.clusterLabel(
                        clusterLabelHandle,
                        true,
                        true,
                        movePreview.deltaQ(),
                        movePreview.deltaR(),
                        movePreview.deltaLevel()));
            }
            addClusterBoundaryMovePreview(edges, boundaries, draggedCells, movePreview);
        }

        private static void addClusterBoundaryMovePreview(
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonBoundarySnapshot> boundaries,
                List<DungeonCellRef> draggedCells,
                ApplyDungeonEditorSessionUseCase.MoveHandlePreviewData movePreview
        ) {
            if (draggedCells.isEmpty()) {
                return;
            }
            for (DungeonBoundarySnapshot boundary : boundaries) {
                if (boundary.edge() == null
                        || boundary.edge().from() == null
                        || boundary.edge().to() == null
                        || !ProjectionSupport.edgeTouchesAnyCell(boundary.edge(), draggedCells)) {
                    continue;
                }
                edges.add(ProjectionSupport.edge(
                        boundary,
                        movePreview.deltaQ(),
                        movePreview.deltaR(),
                        movePreview.deltaLevel(),
                        true,
                        false));
            }
        }

        private static void addHandleMovePreview(
                List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers,
                ApplyDungeonEditorSessionUseCase.PreviewData preview
        ) {
            if (!(preview instanceof ApplyDungeonEditorSessionUseCase.MoveHandlePreviewData movePreview)
                    || movePreview.handleRef().kind() == DungeonEditorHandleKind.CLUSTER_LABEL) {
                return;
            }
            src.domain.dungeon.published.DungeonEditorHandleRef ref = movePreview.handleRef();
            DungeonCellRef cell = ref.cell();
            DungeonCellRef movedCell = new DungeonCellRef(
                    cell.q() + movePreview.deltaQ(),
                    cell.r() + movePreview.deltaR(),
                    cell.level() + movePreview.deltaLevel());
            src.domain.dungeon.published.DungeonEditorHandleRef movedRef = new src.domain.dungeon.published.DungeonEditorHandleRef(
                    ref.kind(),
                    ref.topologyRef(),
                    ref.ownerId(),
                    ref.clusterId(),
                    ref.corridorId(),
                    ref.roomId(),
                    ref.index(),
                    movedCell,
                    ref.direction());
            markers.add(new DungeonEditorMapProjectionSnapshot.MarkerProjection(
                    ProjectionSupport.handleMarkerLabel(ref.kind()),
                    movedCell.q() + 0.5,
                    movedCell.r() + 0.5,
                    movedCell.level(),
                    ProjectionSupport.handleMarkerKind(ref.kind()),
                    true,
                    SnapshotTranslation.toPublishedHandleRefOrEmpty(movedRef),
                    true));
        }

        private static void addBoundaryEdgesPreview(
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                ApplyDungeonEditorSessionUseCase.ClusterBoundariesPreviewData boundaryEdges
        ) {
            DungeonEditorMapProjectionSnapshot.EdgeKind kind = boundaryEdges.boundaryKind() == DungeonBoundaryKind.DOOR
                    ? DungeonEditorMapProjectionSnapshot.EdgeKind.DOOR
                    : DungeonEditorMapProjectionSnapshot.EdgeKind.WALL;
            for (src.domain.dungeon.published.DungeonEdgeRef edge : boundaryEdges.edges()) {
                if (edge == null || edge.from() == null || edge.to() == null) {
                    continue;
                }
                edges.add(new DungeonEditorMapProjectionSnapshot.EdgeProjection(
                        edge.from().q(),
                        edge.from().r(),
                        edge.to().q(),
                        edge.to().r(),
                        edge.from().level(),
                        kind,
                        boundaryEdges.deleteMode() ? "Delete preview" : "Boundary preview",
                        boundaryEdges.clusterId(),
                        DungeonEditorTopologyElementRef.empty(),
                        false,
                        true));
            }
        }
    }

    private static final class ProjectionSupport {

        private ProjectionSupport() {
        }

        private static DungeonEditorMapProjectionSnapshot.CellProjection cell(
                DungeonAreaSnapshot area,
                DungeonCellRef cell,
                boolean selected,
                boolean preview,
                int deltaQ,
                int deltaR,
                int deltaLevel
        ) {
            DungeonEditorMapProjectionSnapshot.CellKind kind = area.kind() == src.domain.dungeon.published.DungeonAreaKind.CORRIDOR
                    ? DungeonEditorMapProjectionSnapshot.CellKind.CORRIDOR
                    : DungeonEditorMapProjectionSnapshot.CellKind.ROOM;
            return new DungeonEditorMapProjectionSnapshot.CellProjection(
                    cell.q() + deltaQ,
                    cell.r() + deltaR,
                    cell.level() + deltaLevel,
                    area.label(),
                    kind,
                    area.id(),
                    area.clusterId(),
                    safeTopologyRef(area.topologyRef()),
                    selected,
                    false,
                    preview,
                    false);
        }

        private static DungeonEditorMapProjectionSnapshot.CellProjection featureCell(
                DungeonFeatureSnapshot feature,
                DungeonCellRef cell,
                boolean selected
        ) {
            DungeonEditorMapProjectionSnapshot.CellKind kind = feature.kind() == src.domain.dungeon.published.DungeonFeatureKind.TRANSITION
                    ? DungeonEditorMapProjectionSnapshot.CellKind.TRANSITION
                    : DungeonEditorMapProjectionSnapshot.CellKind.STAIR;
            return new DungeonEditorMapProjectionSnapshot.CellProjection(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    feature.label(),
                    kind,
                    feature.id(),
                    0L,
                    safeTopologyRef(feature.topologyRef()),
                    selected,
                    false,
                    false,
                    false);
        }

        private static DungeonEditorMapProjectionSnapshot.EdgeProjection edge(
                DungeonBoundarySnapshot boundary,
                int deltaQ,
                int deltaR,
                int deltaLevel,
                boolean preview,
                boolean selected
        ) {
            src.domain.dungeon.published.DungeonEdgeRef edge = boundary.edge();
            DungeonEditorMapProjectionSnapshot.EdgeKind kind = "door".equalsIgnoreCase(boundary.kind())
                    ? DungeonEditorMapProjectionSnapshot.EdgeKind.DOOR
                    : DungeonEditorMapProjectionSnapshot.EdgeKind.WALL;
            return new DungeonEditorMapProjectionSnapshot.EdgeProjection(
                    edge.from().q() + deltaQ,
                    edge.from().r() + deltaR,
                    edge.to().q() + deltaQ,
                    edge.to().r() + deltaR,
                    edge.from().level() + deltaLevel,
                    kind,
                    boundary.label(),
                    boundary.id(),
                    safeTopologyRef(boundary.topologyRef()),
                    selected,
                    preview);
        }

        private static DungeonEditorMapProjectionSnapshot.MarkerProjection featureMarker(
                DungeonFeatureSnapshot feature,
                CellCenter center,
                int level,
                boolean selected
        ) {
            DungeonEditorMapProjectionSnapshot.MarkerKind kind = feature.kind() == src.domain.dungeon.published.DungeonFeatureKind.TRANSITION
                    ? DungeonEditorMapProjectionSnapshot.MarkerKind.WAYPOINT
                    : DungeonEditorMapProjectionSnapshot.MarkerKind.STAIR;
            String label = feature.kind() == src.domain.dungeon.published.DungeonFeatureKind.TRANSITION ? "->" : "z";
            return new DungeonEditorMapProjectionSnapshot.MarkerProjection(
                    label,
                    center.q(),
                    center.r(),
                    level,
                    kind,
                    selected,
                    emptyHandleRef(feature.id(), 0L),
                    false);
        }

        private static DungeonEditorMapProjectionSnapshot.MarkerProjection handleMarker(
                DungeonEditorHandleSnapshot handle,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                boolean preview
        ) {
            src.domain.dungeon.published.DungeonEditorHandleRef ref = handle.ref();
            return new DungeonEditorMapProjectionSnapshot.MarkerProjection(
                    handleMarkerLabel(ref.kind()),
                    handle.cell().q() + 0.5,
                    handle.cell().r() + 0.5,
                    handle.cell().level(),
                    handleMarkerKind(ref.kind()),
                    selectedHandle(ref, selection),
                    SnapshotTranslation.toPublishedHandleRefOrEmpty(ref),
                    preview);
        }

        private static DungeonEditorMapProjectionSnapshot.LabelProjection clusterLabel(
                DungeonEditorHandleSnapshot handle,
                boolean selected,
                boolean preview,
                int deltaQ,
                int deltaR,
                int deltaLevel
        ) {
            DungeonCellRef cell = handle.cell();
            src.domain.dungeon.published.DungeonEditorHandleRef ref = handle.ref();
            return new DungeonEditorMapProjectionSnapshot.LabelProjection(
                    handle.label(),
                    cell.q() + deltaQ + 0.5,
                    cell.r() + deltaR + 0.5,
                    cell.level() + deltaLevel,
                    ref.ownerId(),
                    ref.clusterId(),
                    safeTopologyRef(ref.topologyRef()),
                    selected,
                    preview);
        }

        private static DungeonEditorMapProjectionSnapshot.MarkerKind handleMarkerKind(DungeonEditorHandleKind kind) {
            return switch (kind) {
                case DOOR -> DungeonEditorMapProjectionSnapshot.MarkerKind.DOOR;
                case STAIR_ANCHOR -> DungeonEditorMapProjectionSnapshot.MarkerKind.STAIR;
                case CORRIDOR_ANCHOR, CORRIDOR_WAYPOINT -> DungeonEditorMapProjectionSnapshot.MarkerKind.WAYPOINT;
                case CLUSTER_LABEL -> DungeonEditorMapProjectionSnapshot.MarkerKind.WAYPOINT;
            };
        }

        private static String handleMarkerLabel(DungeonEditorHandleKind kind) {
            return switch (kind) {
                case DOOR -> "D";
                case STAIR_ANCHOR -> "z";
                case CORRIDOR_ANCHOR -> "o";
                case CORRIDOR_WAYPOINT -> "•";
                case CLUSTER_LABEL -> "";
            };
        }

        private static boolean selectedArea(
                @Nullable DungeonAreaSnapshot area,
                ApplyDungeonEditorSessionUseCase.@Nullable SelectionData selection
        ) {
            if (area == null || selection == null) {
                return false;
            }
            if (selection.clusterSelection()) {
                return area.kind() == src.domain.dungeon.published.DungeonAreaKind.ROOM
                        && area.clusterId() == selection.clusterId();
            }
            return safeTopologyRef(area.topologyRef()).equals(safeTopologyRef(selection.topologyRef()));
        }

        private static boolean selectedFeature(
                @Nullable DungeonFeatureSnapshot feature,
                ApplyDungeonEditorSessionUseCase.@Nullable SelectionData selection
        ) {
            return feature != null
                    && selection != null
                    && safeTopologyRef(feature.topologyRef()).equals(safeTopologyRef(selection.topologyRef()));
        }

        private static boolean selectedBoundary(
                @Nullable DungeonBoundarySnapshot boundary,
                ApplyDungeonEditorSessionUseCase.@Nullable SelectionData selection
        ) {
            return boundary != null
                    && selection != null
                    && safeTopologyRef(boundary.topologyRef()).equals(safeTopologyRef(selection.topologyRef()));
        }

        private static boolean selectedHandle(
                src.domain.dungeon.published.@Nullable DungeonEditorHandleRef ref,
                ApplyDungeonEditorSessionUseCase.@Nullable SelectionData selection
        ) {
            if (ref == null || selection == null || selection.handleRef() == null) {
                return false;
            }
            src.domain.dungeon.published.DungeonEditorHandleRef selected = selection.handleRef();
            return ref.kind() == selected.kind()
                    && safeTopologyRef(ref.topologyRef()).equals(safeTopologyRef(selected.topologyRef()))
                    && ref.ownerId() == selected.ownerId()
                    && ref.clusterId() == selected.clusterId()
                    && ref.corridorId() == selected.corridorId()
                    && ref.roomId() == selected.roomId()
                    && ref.index() == selected.index();
        }

        private static boolean selectedClusterLabel(
                @Nullable DungeonEditorHandleSnapshot handle,
                ApplyDungeonEditorSessionUseCase.@Nullable SelectionData selection
        ) {
            if (handle == null || selection == null) {
                return false;
            }
            if (selection.clusterSelection()) {
                return handle.ref().clusterId() > 0L && handle.ref().clusterId() == selection.clusterId();
            }
            return selectedHandle(handle.ref(), selection);
        }

        private static boolean draggedClusterArea(
                @Nullable DungeonAreaSnapshot area,
                ApplyDungeonEditorSessionUseCase.@Nullable SelectionData selection,
                ApplyDungeonEditorSessionUseCase.MoveHandlePreviewData movePreview
        ) {
            if (area == null || movePreview.handleRef().kind() != DungeonEditorHandleKind.CLUSTER_LABEL) {
                return false;
            }
            long selectedClusterId = selection == null || selection.clusterId() <= 0L
                    ? movePreview.handleRef().clusterId()
                    : selection.clusterId();
            return selectedClusterId > 0L
                    && area.kind() == src.domain.dungeon.published.DungeonAreaKind.ROOM
                    && area.clusterId() == selectedClusterId;
        }

        private static Map<String, DungeonAreaSnapshot> indexAreas(List<DungeonAreaSnapshot> areas) {
            Map<String, DungeonAreaSnapshot> result = new java.util.LinkedHashMap<>();
            for (DungeonAreaSnapshot area : areas) {
                result.put(topologyKey(area.topologyRef()), area);
            }
            return result;
        }

        private static Map<String, DungeonBoundarySnapshot> indexBoundaries(List<DungeonBoundarySnapshot> boundaries) {
            Map<String, DungeonBoundarySnapshot> result = new java.util.LinkedHashMap<>();
            for (DungeonBoundarySnapshot boundary : boundaries) {
                result.put(topologyKey(boundary.topologyRef()), boundary);
            }
            return result;
        }

        private static Map<String, DungeonEditorHandleSnapshot> indexHandles(List<DungeonEditorHandleSnapshot> handles) {
            Map<String, DungeonEditorHandleSnapshot> result = new java.util.LinkedHashMap<>();
            for (DungeonEditorHandleSnapshot handle : handles) {
                result.put(handleKey(handle.ref()), handle);
            }
            return result;
        }

        private static String topologyKey(@Nullable DungeonTopologyElementRef topologyRef) {
            DungeonTopologyElementRef safeRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
            return safeRef.kind().name() + ":" + safeRef.id();
        }

        private static String handleKey(src.domain.dungeon.published.@Nullable DungeonEditorHandleRef handleRef) {
            src.domain.dungeon.published.DungeonEditorHandleRef safeRef =
                    handleRef == null ? emptyDomainHandleRef(0L, 0L) : handleRef;
            return safeRef.kind().name()
                    + ":" + topologyKey(safeRef.topologyRef())
                    + ":" + safeRef.ownerId()
                    + ":" + safeRef.clusterId()
                    + ":" + safeRef.corridorId()
                    + ":" + safeRef.roomId()
                    + ":" + safeRef.index();
        }

        private static @Nullable DungeonEditorHandleSnapshot clusterLabelHandle(
                @Nullable List<DungeonEditorHandleSnapshot> handles,
                long clusterId
        ) {
            if (handles == null || clusterId <= 0L) {
                return null;
            }
            for (DungeonEditorHandleSnapshot handle : handles) {
                if (handle != null
                        && handle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL
                        && handle.ref().clusterId() == clusterId) {
                    return handle;
                }
            }
            return null;
        }

        private static boolean edgeTouchesAnyCell(
                src.domain.dungeon.published.@Nullable DungeonEdgeRef edge,
                List<DungeonCellRef> cells
        ) {
            for (DungeonCellRef touchingCell : touchingCells(edge)) {
                for (DungeonCellRef cell : cells) {
                    if (sameCell(touchingCell, cell)) {
                        return true;
                    }
                }
            }
            return false;
        }

        private static List<DungeonCellRef> touchingCells(src.domain.dungeon.published.@Nullable DungeonEdgeRef edge) {
            if (edge == null) {
                return List.of();
            }
            DungeonCellRef from = edge.from();
            DungeonCellRef to = edge.to();
            if (from == null || to == null || from.level() != to.level()) {
                return List.of();
            }
            if (from.r() == to.r()) {
                return horizontalTouchingCells(from, to);
            }
            if (from.q() == to.q()) {
                return verticalTouchingCells(from, to);
            }
            return List.of();
        }

        private static List<DungeonCellRef> horizontalTouchingCells(DungeonCellRef from, DungeonCellRef to) {
            int minQ = Math.min(from.q(), to.q());
            int maxQ = Math.max(from.q(), to.q());
            List<DungeonCellRef> result = new ArrayList<>();
            for (int q = minQ; q < maxQ; q++) {
                result.add(new DungeonCellRef(q, from.r() - 1, from.level()));
                result.add(new DungeonCellRef(q, from.r(), from.level()));
            }
            return List.copyOf(result);
        }

        private static List<DungeonCellRef> verticalTouchingCells(DungeonCellRef from, DungeonCellRef to) {
            int minR = Math.min(from.r(), to.r());
            int maxR = Math.max(from.r(), to.r());
            List<DungeonCellRef> result = new ArrayList<>();
            for (int r = minR; r < maxR; r++) {
                result.add(new DungeonCellRef(from.q() - 1, r, from.level()));
                result.add(new DungeonCellRef(from.q(), r, from.level()));
            }
            return List.copyOf(result);
        }

        private static boolean sameCell(DungeonCellRef left, DungeonCellRef right) {
            return left.q() == right.q() && left.r() == right.r() && left.level() == right.level();
        }

        private static CellCenter centerOf(List<DungeonEditorMapProjectionSnapshot.CellProjection> cells) {
            double q = 0.0;
            double r = 0.0;
            for (DungeonEditorMapProjectionSnapshot.CellProjection cell : cells) {
                q += cell.q() + 0.5;
                r += cell.r() + 0.5;
            }
            int count = Math.max(1, cells.size());
            return new CellCenter(q / count, r / count);
        }

        private static DungeonEditorMapProjectionSnapshot.TopologyKind topology(DungeonTopologyKind topology) {
            return topology == DungeonTopologyKind.HEX
                    ? DungeonEditorMapProjectionSnapshot.TopologyKind.HEX
                    : DungeonEditorMapProjectionSnapshot.TopologyKind.SQUARE;
        }

        private static DungeonEditorTopologyElementRef safeTopologyRef(@Nullable DungeonTopologyElementRef ref) {
            return SnapshotTranslation.toPublishedTopologyRef(ref == null ? DungeonTopologyElementRef.empty() : ref);
        }

        private static DungeonEditorHandleRef emptyHandleRef(long ownerId, long clusterId) {
            return SnapshotTranslation.toPublishedHandleRefOrEmpty(emptyDomainHandleRef(ownerId, clusterId));
        }

        private static src.domain.dungeon.published.DungeonEditorHandleRef emptyDomainHandleRef(long ownerId, long clusterId) {
            return new src.domain.dungeon.published.DungeonEditorHandleRef(
                    DungeonEditorHandleKind.CLUSTER_LABEL,
                    DungeonTopologyElementRef.empty(),
                    ownerId,
                    clusterId,
                    0L,
                    0L,
                    0,
                    new DungeonCellRef(0, 0, 0),
                    "");
        }
    }

    private record ProjectionAccumulator(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers,
            List<DungeonEditorMapProjectionSnapshot.GraphNodeProjection> graphNodes,
            List<DungeonEditorMapProjectionSnapshot.GraphLinkProjection> graphLinks
    ) {
    }

    private record CellCenter(double q, double r) {
    }
}
