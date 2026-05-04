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
import src.domain.dungeoneditor.published.DungeonEditorTopologyElementRef;
import src.domain.dungeoneditor.published.LoadDungeonEditorQuery;

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
        LoadDungeonEditorQuery effectiveQuery = query == null ? new LoadDungeonEditorQuery(null) : query;
        if (effectiveQuery.mapId() != null) {
            applyDungeonEditorSessionUseCase.primeSelectedMap(toDomainMapId(effectiveQuery.mapId()));
        }
        return editorModel;
    }

    public DungeonEditorSnapshot applyEditorSession(ApplyDungeonEditorSessionCommand command) {
        applyDungeonEditorSessionUseCase.apply(toInternalCommand(command));
        DungeonEditorSnapshot snapshot = currentEditorSnapshot();
        notifyEditorListeners(snapshot);
        return snapshot;
    }

    private DungeonEditorSnapshot currentEditorSnapshot() {
        return toPublishedSnapshot(applyDungeonEditorSessionUseCase.snapshot());
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

    private static ApplyDungeonEditorSessionUseCase.Command toInternalCommand(ApplyDungeonEditorSessionCommand command) {
        ApplyDungeonEditorSessionCommand effective = command == null
                ? new ApplyDungeonEditorSessionCommand(
                ApplyDungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW,
                null,
                "",
                "GRID",
                "Auswahl",
                0,
                DungeonEditorOverlaySettings.defaults(),
                ApplyDungeonEditorSessionCommand.MainViewInput.empty(),
                ApplyDungeonEditorSessionCommand.RoomNarrationInput.empty())
                : command;
        return new ApplyDungeonEditorSessionUseCase.Command(
                ApplyDungeonEditorSessionUseCase.Action.valueOf(effective.action().name()),
                toDomainMapId(effective.mapId()),
                effective.mapName(),
                effective.viewModeKey(),
                effective.selectedTool(),
                effective.projectionLevelDelta(),
                toInternalOverlay(effective.overlaySettings()),
                toInternalMainViewInput(effective.mainViewInput()),
                toInternalRoomNarration(effective.roomNarration()));
    }

    private static ApplyDungeonEditorSessionUseCase.OverlayData toInternalOverlay(
            DungeonEditorOverlaySettings overlaySettings
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
            ApplyDungeonEditorSessionCommand.MainViewInput mainViewInput
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
            ApplyDungeonEditorSessionCommand.RoomNarrationInput roomNarration
    ) {
        ApplyDungeonEditorSessionCommand.RoomNarrationInput safeNarration = roomNarration == null
                ? ApplyDungeonEditorSessionCommand.RoomNarrationInput.empty()
                : roomNarration;
        return new ApplyDungeonEditorSessionUseCase.RoomNarrationInput(
                safeNarration.roomId(),
                safeNarration.visualDescription(),
                safeNarration.exits().stream().map(DungeonEditorApplicationService::toDomainRoomExit).toList());
    }

    private static DungeonEditorSnapshot toPublishedSnapshot(ApplyDungeonEditorSessionUseCase.SnapshotData snapshot) {
        ApplyDungeonEditorSessionUseCase.SnapshotData safeSnapshot = snapshot == null
                ? ApplyDungeonEditorSessionUseCase.SnapshotData.empty("")
                : snapshot;
        DungeonEditorSnapshot.Selection publishedSelection = toPublishedSelection(safeSnapshot.selection());
        DungeonEditorSurface publishedSurface = toPublishedSurface(safeSnapshot.surface());
        DungeonEditorPreview publishedPreview = toPublishedPreview(safeSnapshot.preview());
        return new DungeonEditorSnapshot(
                safeSnapshot.maps().stream().map(DungeonEditorApplicationService::toPublishedMapSummary).toList(),
                toPublishedMapId(safeSnapshot.selectedMapId()),
                safeSnapshot.viewModeKey(),
                safeSnapshot.selectedTool(),
                safeSnapshot.projectionLevel(),
                toPublishedOverlay(safeSnapshot.overlaySettings()),
                publishedSelection,
                publishedSurface,
                publishedPreview,
                toPublishedProjection(safeSnapshot.surface(), safeSnapshot.selection(), safeSnapshot.preview()),
                safeSnapshot.statusText());
    }

    private static DungeonEditorOverlaySettings toPublishedOverlay(
            ApplyDungeonEditorSessionUseCase.OverlayData overlay
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
            ApplyDungeonEditorSessionUseCase.SelectionData selection
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

    private static DungeonEditorPreview toPublishedPreview(ApplyDungeonEditorSessionUseCase.PreviewData preview) {
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
                            boundaries.edges().stream().map(DungeonEditorApplicationService::toPublishedEdge).toList(),
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
                            stretch.sourceEdges().stream().map(DungeonEditorApplicationService::toPublishedEdge).toList(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case ApplyDungeonEditorSessionUseCase.NonePreviewData ignored -> DungeonEditorPreview.none();
        };
    }

    private static @Nullable DungeonMapId toDomainMapId(@Nullable DungeonEditorMapId mapId) {
        return mapId == null ? null : new DungeonMapId(mapId.value());
    }

    private static DungeonInspectorSnapshot.RoomExitNarration toDomainRoomExit(
            DungeonEditorInspectorSnapshot.RoomExitNarration exit
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

    private static DungeonEditorMapSummary toPublishedMapSummary(DungeonMapSummary map) {
        DungeonMapSummary safeMap = map == null ? new DungeonMapSummary(new DungeonMapId(1L), "Dungeon Map", 0L) : map;
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

    private static @Nullable DungeonEditorMapProjectionSnapshot toPublishedProjection(
            ApplyDungeonEditorSessionUseCase.@Nullable SurfaceData surface,
            ApplyDungeonEditorSessionUseCase.SelectionData selection,
            ApplyDungeonEditorSessionUseCase.PreviewData preview
    ) {
        if (surface == null) {
            return null;
        }
        return EditorMapProjectionPublication.projection(
                surface,
                selection == null ? ApplyDungeonEditorSessionUseCase.SelectionData.empty() : selection,
                preview == null ? ApplyDungeonEditorSessionUseCase.PreviewData.none() : preview);
    }

    private static DungeonEditorMapSnapshot toPublishedMap(DungeonMapSnapshot map) {
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        return new DungeonEditorMapSnapshot(
                safeMap.topology().name(),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonEditorApplicationService::toPublishedArea).toList(),
                safeMap.boundaries().stream().map(DungeonEditorApplicationService::toPublishedBoundary).toList(),
                safeMap.features().stream().map(DungeonEditorApplicationService::toPublishedFeature).toList(),
                safeMap.editorHandles().stream().map(DungeonEditorApplicationService::toPublishedEditorHandle).toList());
    }

    private static DungeonEditorMapSnapshot.Area toPublishedArea(DungeonAreaSnapshot area) {
        DungeonAreaSnapshot safeArea = area == null ? null : area;
        if (safeArea == null) {
            return new DungeonEditorMapSnapshot.Area("ROOM", 1L, "ROOM", List.of());
        }
        return new DungeonEditorMapSnapshot.Area(
                safeArea.kind().name(),
                safeArea.id(),
                safeArea.label(),
                safeArea.cells().stream().map(DungeonEditorApplicationService::toPublishedCell).toList());
    }

    private static DungeonEditorMapSnapshot.Boundary toPublishedBoundary(DungeonBoundarySnapshot boundary) {
        DungeonBoundarySnapshot safeBoundary = boundary == null
                ? null
                : boundary;
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

    private static DungeonEditorMapSnapshot.Feature toPublishedFeature(DungeonFeatureSnapshot feature) {
        DungeonFeatureSnapshot safeFeature = feature == null ? null : feature;
        if (safeFeature == null) {
            return new DungeonEditorMapSnapshot.Feature("STAIR", 1L, "STAIR", List.of(), "", "");
        }
        return new DungeonEditorMapSnapshot.Feature(
                safeFeature.kind().name(),
                safeFeature.id(),
                safeFeature.label(),
                safeFeature.cells().stream().map(DungeonEditorApplicationService::toPublishedCell).toList(),
                safeFeature.description(),
                safeFeature.destinationLabel());
    }

    private static DungeonEditorMapSnapshot.EditorHandle toPublishedEditorHandle(DungeonEditorHandleSnapshot handle) {
        DungeonEditorHandleSnapshot safeHandle = handle == null ? null : handle;
        if (safeHandle == null) {
            return new DungeonEditorMapSnapshot.EditorHandle(DungeonEditorHandleRef.empty(), "CLUSTER_LABEL", new DungeonEditorCell(0, 0, 0));
        }
        return new DungeonEditorMapSnapshot.EditorHandle(
                toPublishedHandleRefOrEmpty(safeHandle.ref()),
                safeHandle.label(),
                toPublishedCell(safeHandle.cell()));
    }

    private static @Nullable DungeonEditorInspectorSnapshot toPublishedInspector(@Nullable DungeonInspectorSnapshot inspector) {
        if (inspector == null) {
            return null;
        }
        return new DungeonEditorInspectorSnapshot(
                inspector.title(),
                inspector.summary(),
                inspector.facts(),
                inspector.roomNarrations().stream().map(DungeonEditorApplicationService::toPublishedRoomNarrationCard).toList());
    }

    private static DungeonEditorInspectorSnapshot.RoomNarrationCard toPublishedRoomNarrationCard(
            DungeonInspectorSnapshot.RoomNarrationCard card
    ) {
        DungeonInspectorSnapshot.RoomNarrationCard safeCard = card == null
                ? new DungeonInspectorSnapshot.RoomNarrationCard(0L, "Raum", "", List.of())
                : card;
        return new DungeonEditorInspectorSnapshot.RoomNarrationCard(
                safeCard.roomId(),
                safeCard.roomName(),
                safeCard.visualDescription(),
                safeCard.exits().stream().map(DungeonEditorApplicationService::toPublishedRoomExit).toList());
    }

    private static DungeonEditorInspectorSnapshot.RoomExitNarration toPublishedRoomExit(
            DungeonInspectorSnapshot.RoomExitNarration exit
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
            src.domain.dungeon.published.DungeonTopologyElementRef ref
    ) {
        return ref == null
                ? DungeonEditorTopologyElementRef.empty()
                : new DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
    }

    private static DungeonEditorHandleRef toPublishedHandleRefOrEmpty(
            src.domain.dungeon.published.DungeonEditorHandleRef handleRef
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

    private static DungeonEditorCell toPublishedCell(DungeonCellRef cell) {
        return cell == null ? new DungeonEditorCell(0, 0, 0) : new DungeonEditorCell(cell.q(), cell.r(), cell.level());
    }

    private static DungeonEditorEdge toPublishedEdge(src.domain.dungeon.published.DungeonEdgeRef edge) {
        if (edge == null) {
            return new DungeonEditorEdge(new DungeonEditorCell(0, 0, 0), new DungeonEditorCell(0, 0, 0));
        }
        return new DungeonEditorEdge(toPublishedCell(edge.from()), toPublishedCell(edge.to()));
    }

    private static final class EditorMapProjectionPublication {

        private EditorMapProjectionPublication() {
        }

        private static DungeonEditorMapProjectionSnapshot projection(
                ApplyDungeonEditorSessionUseCase.SurfaceData surface,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ApplyDungeonEditorSessionUseCase.PreviewData preview
        ) {
            DungeonMapSnapshot map = surface.map();
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells = new ArrayList<>();
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges = new ArrayList<>();
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels = new ArrayList<>();
            List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers = new ArrayList<>();
            List<DungeonEditorMapProjectionSnapshot.GraphNodeProjection> graphNodes = new ArrayList<>();
            List<DungeonEditorMapProjectionSnapshot.GraphLinkProjection> graphLinks = new ArrayList<>();
            renderAreas(map, selection, cells, graphNodes);
            renderClusterLabels(map, selection, labels);
            addPreviewAndBoundaries(
                    map,
                    selection,
                    preview,
                    surface.previewMap(),
                    cells,
                    edges,
                    labels);
            renderFeatures(map, selection, cells, labels, markers);
            renderHandles(map, selection, preview, markers);
            addPreviewMapDiff(
                    map,
                    selection,
                    preview,
                    surface.previewMap(),
                    cells,
                    edges,
                    labels,
                    markers);
            addFallbackGraphLinks(graphNodes, graphLinks);
            return new DungeonEditorMapProjectionSnapshot(
                    surface.mapName(),
                    topology(map.topology()),
                    map.width(),
                    map.height(),
                    cells,
                    edges,
                    labels,
                    markers,
                    graphNodes,
                    graphLinks,
                    null);
        }

        private static void renderAreas(
                DungeonMapSnapshot map,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.GraphNodeProjection> graphNodes
        ) {
            for (DungeonAreaSnapshot area : map.areas()) {
                boolean selected = selectedArea(area, selection);
                List<DungeonEditorMapProjectionSnapshot.CellProjection> areaCells = area.cells().stream()
                        .map(cell -> cell(area, cell, selected, false, 0, 0, 0))
                        .toList();
                cells.addAll(areaCells);
                if (areaCells.isEmpty()) {
                    continue;
                }
                CellCenter center = centerOf(areaCells);
                graphNodes.add(new DungeonEditorMapProjectionSnapshot.GraphNodeProjection(
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
                labels.add(clusterLabel(handle, selectedClusterLabel(handle, selection), false, 0, 0, 0));
            }
        }

        private static void addPreviewAndBoundaries(
                DungeonMapSnapshot map,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ApplyDungeonEditorSessionUseCase.PreviewData preview,
                @Nullable DungeonMapSnapshot previewMap,
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels
        ) {
            addEditorPreview(
                    cells,
                    edges,
                    labels,
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
                edges.add(edge(boundary, 0, 0, 0, false, selectedBoundary(boundary, selection)));
            }
        }

        private static void addPreviewMapDiff(
                DungeonMapSnapshot map,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                ApplyDungeonEditorSessionUseCase.PreviewData preview,
                @Nullable DungeonMapSnapshot previewMap,
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers
        ) {
            if (!(preview instanceof ApplyDungeonEditorSessionUseCase.NonePreviewData) || previewMap == null) {
                return;
            }
            addPreviewAreaDiff(cells, labels, map.areas(), previewMap.areas(), selection);
            addPreviewBoundaryDiff(edges, map.boundaries(), previewMap.boundaries(), selection);
            addPreviewHandleDiff(markers, map.editorHandles(), previewMap.editorHandles(), selection);
        }

        private static void renderFeatures(
                DungeonMapSnapshot map,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers
        ) {
            for (DungeonFeatureSnapshot feature : map.features()) {
                List<DungeonEditorMapProjectionSnapshot.CellProjection> featureCells = feature.cells().stream()
                        .map(cell -> featureCell(feature, cell, selectedFeature(feature, selection)))
                        .toList();
                cells.addAll(featureCells);
                if (featureCells.isEmpty()) {
                    continue;
                }
                CellCenter center = centerOf(featureCells);
                boolean selected = selectedFeature(feature, selection);
                labels.add(new DungeonEditorMapProjectionSnapshot.LabelProjection(
                        feature.label(),
                        center.q(),
                        center.r(),
                        featureCells.getFirst().level(),
                        feature.id(),
                        0L,
                        safeTopologyRef(feature.topologyRef()),
                        selected,
                        false));
                markers.add(featureMarker(feature, center, featureCells.getFirst().level(), selected));
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
                markers.add(handleMarker(handle, selection, false));
            }
            addHandleMovePreview(markers, preview);
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
                        .map(cell -> cell(area, cell, selectedArea(area, selection), true, 0, 0, 0))
                        .forEach(cells::add);
            }
            DungeonEditorHandleSnapshot previewHandle =
                    clusterLabelHandle(previewMap.editorHandles(), movePreview.clusterId());
            if (previewHandle != null) {
                labels.add(clusterLabel(previewHandle, true, true, 0, 0, 0));
            }
            for (DungeonBoundarySnapshot boundary : previewMap.boundaries()) {
                if (boundary.edge() == null
                        || boundary.edge().from() == null
                        || boundary.edge().to() == null
                        || !edgeTouchesAnyCell(boundary.edge(), previewClusterCells)) {
                    continue;
                }
                edges.add(edge(boundary, 0, 0, 0, true, false));
            }
        }

        private static void addPreviewAreaDiff(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                List<DungeonAreaSnapshot> committedAreas,
                List<DungeonAreaSnapshot> previewAreas,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
        ) {
            Map<String, DungeonAreaSnapshot> committedByTopology = indexAreas(committedAreas);
            for (DungeonAreaSnapshot previewArea : previewAreas) {
                DungeonAreaSnapshot committedArea = committedByTopology.remove(
                        topologyKey(previewArea.topologyRef()));
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
            boolean selected = selectedArea(area, selection);
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
                            safeTopologyRef(area.topologyRef()),
                            selected,
                            false,
                            true,
                            destructive))
                    .toList();
            cells.addAll(previewCells);
            if (previewCells.isEmpty()) {
                return;
            }
            CellCenter center = centerOf(previewCells);
            labels.add(new DungeonEditorMapProjectionSnapshot.LabelProjection(
                    area.label(),
                    center.q(),
                    center.r(),
                    previewCells.getFirst().level(),
                    area.id(),
                    area.clusterId(),
                    safeTopologyRef(area.topologyRef()),
                    selected,
                    true));
        }

        private static void addPreviewBoundaryDiff(
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonBoundarySnapshot> committedBoundaries,
                List<DungeonBoundarySnapshot> previewBoundaries,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
        ) {
            Map<String, DungeonBoundarySnapshot> committedByTopology =
                    indexBoundaries(committedBoundaries);
            for (DungeonBoundarySnapshot previewBoundary : previewBoundaries) {
                DungeonBoundarySnapshot committedBoundary = committedByTopology.remove(
                        topologyKey(previewBoundary.topologyRef()));
                if (previewBoundary.equals(committedBoundary)) {
                    continue;
                }
                edges.add(edge(previewBoundary, 0, 0, 0, true, selectedBoundary(previewBoundary, selection)));
            }
            for (DungeonBoundarySnapshot removedBoundary : committedByTopology.values()) {
                edges.add(edge(removedBoundary, 0, 0, 0, true, selectedBoundary(removedBoundary, selection)));
            }
        }

        private static void addPreviewHandleDiff(
                List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers,
                List<DungeonEditorHandleSnapshot> committedHandles,
                List<DungeonEditorHandleSnapshot> previewHandles,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
        ) {
            Map<String, DungeonEditorHandleSnapshot> committedByHandle =
                    indexHandles(committedHandles);
            for (DungeonEditorHandleSnapshot previewHandle : previewHandles) {
                if (previewHandle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL) {
                    continue;
                }
                DungeonEditorHandleSnapshot committedHandle = committedByHandle.remove(
                        handleKey(previewHandle.ref()));
                if (previewHandle.equals(committedHandle)) {
                    continue;
                }
                markers.add(handleMarker(previewHandle, selection, true));
            }
            for (DungeonEditorHandleSnapshot removedHandle : committedByHandle.values()) {
                if (removedHandle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL) {
                    continue;
                }
                markers.add(handleMarker(removedHandle, selection, true));
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
                if (!draggedClusterArea(area, selection, movePreview)) {
                    continue;
                }
                List<DungeonEditorMapProjectionSnapshot.CellProjection> previewCells = area.cells().stream()
                        .map(cell -> cell(
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
                    clusterLabelHandle(handles, movePreview.handleRef().clusterId());
            if (clusterLabelHandle != null) {
                labels.add(clusterLabel(
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
                        || !edgeTouchesAnyCell(boundary.edge(), draggedCells)) {
                    continue;
                }
                edges.add(edge(
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
                    handleMarkerLabel(ref.kind()),
                    movedCell.q() + 0.5,
                    movedCell.r() + 0.5,
                    movedCell.level(),
                    handleMarkerKind(ref.kind()),
                    true,
                    toPublishedHandleRefOrEmpty(movedRef),
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
                    toPublishedHandleRefOrEmpty(ref),
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
                DungeonAreaSnapshot area,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
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
                DungeonFeatureSnapshot feature,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
        ) {
            return feature != null
                    && selection != null
                    && safeTopologyRef(feature.topologyRef()).equals(safeTopologyRef(selection.topologyRef()));
        }

        private static boolean selectedBoundary(
                DungeonBoundarySnapshot boundary,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
        ) {
            return boundary != null
                    && selection != null
                    && safeTopologyRef(boundary.topologyRef()).equals(safeTopologyRef(selection.topologyRef()));
        }

        private static boolean selectedHandle(
                src.domain.dungeon.published.DungeonEditorHandleRef ref,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
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
                DungeonEditorHandleSnapshot handle,
                ApplyDungeonEditorSessionUseCase.SelectionData selection
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
                DungeonAreaSnapshot area,
                ApplyDungeonEditorSessionUseCase.SelectionData selection,
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
            return toPublishedTopologyRef(ref == null ? DungeonTopologyElementRef.empty() : ref);
        }

        private static DungeonEditorHandleRef emptyHandleRef(long ownerId, long clusterId) {
            return toPublishedHandleRefOrEmpty(emptyDomainHandleRef(ownerId, clusterId));
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

        private record CellCenter(double q, double r) {
        }
    }
}
