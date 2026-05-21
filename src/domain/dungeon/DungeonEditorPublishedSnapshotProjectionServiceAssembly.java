package src.domain.dungeon;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorBoundaryTouchGeometry;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapProjectionContent;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;

final class DungeonEditorPublishedSnapshotProjectionServiceAssembly {

    public PublishedSnapshots execute(DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot) {
        DungeonEditorSessionSnapshot.SnapshotData safeSnapshot = safeSnapshot(snapshot);
        SurfaceContext surfaceContext = surfaceContext(safeSnapshot.surface(), safeSnapshot.projectionLevel());
        return new PublishedSnapshots(
                toControlsSnapshot(safeSnapshot, surfaceContext),
                toMapSurfaceSnapshot(safeSnapshot),
                toStateSnapshot(safeSnapshot, surfaceContext));
    }

    record PublishedSnapshots(
            DungeonEditorControlsSnapshot controls,
            DungeonEditorMapSurfaceSnapshot mapSurface,
            DungeonEditorStateSnapshot state
    ) {
    }

    private record SurfaceContext(
            @Nullable DungeonEditorSurface surface,
            List<Integer> reachableLevels,
            boolean surfacePresent
    ) {
    }

    private static SurfaceContext surfaceContext(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int fallbackLevel
    ) {
        SortedSet<Integer> levels = new TreeSet<>();
        if (surface != null && surface.map() != null) {
            addWorkspaceMapLevels(levels, surface.map());
            if (surface.previewMap() != null) {
                addWorkspaceMapLevels(levels, surface.previewMap());
            }
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new SurfaceContext(toPublishedSurface(surface), new ArrayList<>(levels), surface != null);
    }

    private static void addWorkspaceMapLevels(
            SortedSet<Integer> levels,
            DungeonEditorWorkspaceValues.MapSnapshot map
    ) {
        for (DungeonEditorWorkspaceValues.Area area : map.areas()) {
            addWorkspaceCellLevels(levels, area.cells());
        }
        for (DungeonEditorWorkspaceValues.Feature feature : map.features()) {
            addWorkspaceCellLevels(levels, feature.cells());
        }
        for (DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
            levels.add(handle.cell().level());
        }
    }

    private static void addWorkspaceCellLevels(
            SortedSet<Integer> levels,
            List<DungeonEditorWorkspaceValues.Cell> cells
    ) {
        for (DungeonEditorWorkspaceValues.Cell cell : cells == null ? List.<DungeonEditorWorkspaceValues.Cell>of() : cells) {
            levels.add(cell.level());
        }
    }

    private static DungeonEditorControlsSnapshot toControlsSnapshot(
            DungeonEditorSessionSnapshot.SnapshotData safeSnapshot,
            SurfaceContext surfaceContext
    ) {
            return new DungeonEditorControlsSnapshot(
                    publishedMapSummaries(safeSnapshot.maps()),
                    toPublishedMapId(safeSnapshot.selectedMapId()),
                    toPublishedViewMode(safeSnapshot.viewMode()),
                    toPublishedTool(safeSnapshot.selectedTool()),
                    safeSnapshot.projectionLevel(),
                    toPublishedOverlay(safeSnapshot.overlaySettings()),
                    surfaceContext.reachableLevels(),
                    surfaceContext.surfacePresent(),
                    safeSnapshot.statusText());
        }

    private static DungeonEditorStateSnapshot toStateSnapshot(
            DungeonEditorSessionSnapshot.SnapshotData safeSnapshot,
            SurfaceContext surfaceContext
    ) {
        DungeonEditorSurface surface = surfaceContext.surface();
            return new DungeonEditorStateSnapshot(
                    toPublishedSelection(safeSnapshot.selection()),
                    surface == null ? null : surface.inspector(),
                    toPublishedPreview(safeSnapshot.preview()),
                    safeSnapshot.statusText(),
                    toPublishedViewMode(safeSnapshot.viewMode()),
                    toPublishedTool(safeSnapshot.selectedTool()),
                    toPublishedOverlay(safeSnapshot.overlaySettings()),
                    safeSnapshot.projectionLevel());
        }

    private static DungeonEditorMapSurfaceSnapshot toMapSurfaceSnapshot(
            DungeonEditorSessionSnapshot.SnapshotData safeSnapshot
    ) {
            return new DungeonEditorMapSurfaceSnapshot(
                    projection(safeSnapshot.surface(), safeSnapshot.selection(), safeSnapshot.preview()),
                    toPublishedViewMode(safeSnapshot.viewMode()),
                    toPublishedOverlay(safeSnapshot.overlaySettings()),
                    safeSnapshot.projectionLevel(),
                    toPublishedTool(safeSnapshot.selectedTool()));
        }

    private static DungeonEditorSessionSnapshot.SnapshotData safeSnapshot(
                DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
        ) {
            return snapshot == null ? DungeonEditorSessionSnapshot.SnapshotData.empty("") : snapshot;
        }

    private static List<DungeonMapSummary> publishedMapSummaries(
                List<DungeonEditorWorkspaceValues.MapSummary> maps
        ) {
            List<DungeonMapSummary> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.MapSummary map : maps == null ? List.<DungeonEditorWorkspaceValues.MapSummary>of() : maps) {
                result.add(toPublishedMapSummary(map));
            }
            return List.copyOf(result);
        }

    private static DungeonMapSummary toPublishedMapSummary(DungeonEditorWorkspaceValues.@Nullable MapSummary map) {
            DungeonEditorWorkspaceValues.MapSummary safeMap = map == null
                    ? new DungeonEditorWorkspaceValues.MapSummary(new DungeonEditorWorkspaceValues.MapId(1L), "Dungeon Map", 0L)
                    : map;
            return new DungeonMapSummary(
                    new DungeonMapId(safeMap.mapId().value()),
                    safeMap.mapName(),
                    safeMap.revision());
        }

    private static @Nullable DungeonMapId toPublishedMapId(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
            return mapId == null ? null : new DungeonMapId(mapId.value());
        }

    private static @Nullable DungeonEditorSurface toPublishedSurface(
                DungeonEditorSessionSnapshot.@Nullable SurfaceData surface
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

    private static DungeonEditorMapSnapshot toPublishedMap(DungeonEditorWorkspaceValues.@Nullable MapSnapshot map) {
            DungeonEditorWorkspaceValues.MapSnapshot safeMap = map == null
                    ? DungeonEditorWorkspaceValues.MapSnapshot.empty()
                    : map;
            return new DungeonEditorMapSnapshot(
                    safeMap.topology().name(),
                    safeMap.width(),
                    safeMap.height(),
                    toPublishedAreas(safeMap.areas()),
                    toPublishedBoundaries(safeMap.boundaries()),
                    toPublishedFeatures(safeMap.features()),
                    toPublishedEditorHandles(safeMap.editorHandles()));
        }

    private static List<DungeonEditorMapSnapshot.Area> toPublishedAreas(
                List<DungeonEditorWorkspaceValues.Area> areas
        ) {
            List<DungeonEditorMapSnapshot.Area> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Area area : areas == null ? List.<DungeonEditorWorkspaceValues.Area>of() : areas) {
                result.add(toPublishedArea(area));
            }
            return List.copyOf(result);
        }

    private static DungeonEditorMapSnapshot.Area toPublishedArea(DungeonEditorWorkspaceValues.@Nullable Area area) {
            if (area == null) {
                return new DungeonEditorMapSnapshot.Area("ROOM", 1L, "ROOM", List.of());
            }
            return new DungeonEditorMapSnapshot.Area(
                    area.kind().name(),
                    area.id(),
                    area.label(),
                    toPublishedCells(area.cells()));
        }

    private static List<DungeonEditorMapSnapshot.Boundary> toPublishedBoundaries(
                List<DungeonEditorWorkspaceValues.Boundary> boundaries
        ) {
            List<DungeonEditorMapSnapshot.Boundary> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Boundary boundary : boundaries == null ? List.<DungeonEditorWorkspaceValues.Boundary>of() : boundaries) {
                result.add(toPublishedBoundary(boundary));
            }
            return List.copyOf(result);
        }

    private static DungeonEditorMapSnapshot.Boundary toPublishedBoundary(
                DungeonEditorWorkspaceValues.@Nullable Boundary boundary
        ) {
            if (boundary == null) {
                return new DungeonEditorMapSnapshot.Boundary(
                        "boundary",
                        1L,
                        "boundary",
                        new DungeonEdgeRef(new DungeonCellRef(0, 0, 0), new DungeonCellRef(0, 0, 0)),
                        DungeonEditorTopologyElementRef.empty());
            }
            return new DungeonEditorMapSnapshot.Boundary(
                    boundary.kind().externalKind(),
                    boundary.id(),
                    boundary.label(),
                    toPublishedEdge(boundary.edge()),
                    toPublishedTopologyRef(boundary.topologyRef()));
        }

    private static List<DungeonEditorMapSnapshot.Feature> toPublishedFeatures(
                List<DungeonEditorWorkspaceValues.Feature> features
        ) {
            List<DungeonEditorMapSnapshot.Feature> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Feature feature : features == null ? List.<DungeonEditorWorkspaceValues.Feature>of() : features) {
                result.add(toPublishedFeature(feature));
            }
            return List.copyOf(result);
        }

    private static DungeonEditorMapSnapshot.Feature toPublishedFeature(
                DungeonEditorWorkspaceValues.@Nullable Feature feature
        ) {
            if (feature == null) {
                return new DungeonEditorMapSnapshot.Feature("STAIR", 1L, "STAIR", List.of(), "", "");
            }
            return new DungeonEditorMapSnapshot.Feature(
                    feature.kind().name(),
                    feature.id(),
                    feature.label(),
                    toPublishedCells(feature.cells()),
                    feature.description(),
                    feature.destinationLabel());
        }

    private static List<DungeonEditorHandleSnapshot> toPublishedEditorHandles(
                List<DungeonEditorWorkspaceValues.Handle> handles
        ) {
            List<DungeonEditorHandleSnapshot> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Handle handle : handles == null ? List.<DungeonEditorWorkspaceValues.Handle>of() : handles) {
                result.add(toPublishedEditorHandle(handle));
            }
            return List.copyOf(result);
        }

    private static DungeonEditorHandleSnapshot toPublishedEditorHandle(
                DungeonEditorWorkspaceValues.@Nullable Handle handle
        ) {
            if (handle == null) {
                return new DungeonEditorHandleSnapshot(
                        DungeonEditorHandleRef.empty(),
                        "CLUSTER_LABEL",
                        new DungeonCellRef(0, 0, 0));
            }
            return new DungeonEditorHandleSnapshot(
                    toPublishedHandleRefOrEmpty(handle.ref()),
                    handle.label(),
                    toPublishedCell(handle.cell()));
        }

    private static List<DungeonCellRef> toPublishedCells(List<DungeonEditorWorkspaceValues.Cell> cells) {
            List<DungeonCellRef> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Cell cell : cells == null ? List.<DungeonEditorWorkspaceValues.Cell>of() : cells) {
                result.add(toPublishedCell(cell));
            }
            return List.copyOf(result);
        }

    private static @Nullable DungeonInspectorSnapshot toPublishedInspector(
                DungeonEditorWorkspaceValues.@Nullable Inspector inspector
        ) {
            if (inspector == null) {
                return null;
            }
            return new DungeonInspectorSnapshot(
                    inspector.title(),
                    inspector.summary(),
                    inspector.facts(),
                    toPublishedRoomNarrationCards(inspector.roomNarrations()));
        }

    private static List<DungeonInspectorSnapshot.RoomNarrationCard> toPublishedRoomNarrationCards(
                List<DungeonEditorWorkspaceValues.RoomNarrationCard> cards
        ) {
            List<DungeonInspectorSnapshot.RoomNarrationCard> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.RoomNarrationCard card : cards == null ? List.<DungeonEditorWorkspaceValues.RoomNarrationCard>of() : cards) {
                result.add(toPublishedRoomNarrationCard(card));
            }
            return List.copyOf(result);
        }

    private static DungeonInspectorSnapshot.RoomNarrationCard toPublishedRoomNarrationCard(
                DungeonEditorWorkspaceValues.@Nullable RoomNarrationCard card
        ) {
            DungeonEditorWorkspaceValues.RoomNarrationCard safeCard = card == null
                    ? new DungeonEditorWorkspaceValues.RoomNarrationCard(0L, "Raum", "", List.of())
                    : card;
            return new DungeonInspectorSnapshot.RoomNarrationCard(
                    safeCard.roomId(),
                    safeCard.roomName(),
                    safeCard.visualDescription(),
                    toPublishedRoomExits(safeCard.exits()));
        }

    private static List<DungeonInspectorSnapshot.RoomExitNarration> toPublishedRoomExits(
                List<DungeonEditorWorkspaceValues.RoomExitNarration> exits
        ) {
            List<DungeonInspectorSnapshot.RoomExitNarration> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.RoomExitNarration exit : exits == null ? List.<DungeonEditorWorkspaceValues.RoomExitNarration>of() : exits) {
                result.add(toPublishedRoomExit(exit));
            }
            return List.copyOf(result);
        }

    private static DungeonInspectorSnapshot.RoomExitNarration toPublishedRoomExit(
                DungeonEditorWorkspaceValues.@Nullable RoomExitNarration exit
        ) {
            DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                    ? new DungeonEditorWorkspaceValues.RoomExitNarration("", DungeonEditorWorkspaceValues.Cell.empty(), "", "")
                    : exit;
            return new DungeonInspectorSnapshot.RoomExitNarration(
                    safeExit.label(),
                    toPublishedCell(safeExit.cell()),
                    safeExit.direction(),
                    safeExit.description());
        }

    private static DungeonOverlaySettings toPublishedOverlay(
                DungeonEditorSessionValues.@Nullable OverlaySettings overlay
        ) {
            DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                    ? DungeonEditorSessionValues.OverlaySettings.defaults()
                    : overlay;
            return new DungeonOverlaySettings(
                    safeOverlay.modeKey(),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    safeOverlay.selectedLevels());
        }

    private static DungeonEditorStateSnapshot.Selection toPublishedSelection(
                DungeonEditorSessionValues.@Nullable Selection selection
        ) {
            DungeonEditorSessionValues.Selection safeSelection = selection == null
                    ? DungeonEditorSessionValues.Selection.empty()
                    : selection;
            return new DungeonEditorStateSnapshot.Selection(
                    toPublishedTopologyRef(safeSelection.topologyRef()),
                    safeSelection.clusterId(),
                    safeSelection.clusterSelection(),
                    safeSelection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef())
                            ? null
                            : toPublishedHandleRefOrEmpty(safeSelection.handleRef()));
        }

    private static DungeonEditorPreview toPublishedPreview(DungeonEditorSessionValues.@Nullable Preview preview) {
            if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
                return DungeonEditorPreview.none();
            }
            return switch (preview) {
                case DungeonEditorSessionValues.RoomRectanglePreview room ->
                        new DungeonEditorPreview.RoomRectanglePreview(
                                toPublishedCell(room.start()),
                                toPublishedCell(room.end()),
                                room.deleteMode());
                case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries ->
                        new DungeonEditorPreview.ClusterBoundariesPreview(
                                boundaries.clusterId(),
                                toPublishedEdges(boundaries.edges()),
                                boundaries.boundaryKind().name(),
                                boundaries.deleteMode());
                case DungeonEditorSessionValues.MoveHandlePreview moveHandle ->
                        new DungeonEditorPreview.MoveHandlePreview(
                                toPublishedHandleRefOrEmpty(moveHandle.handleRef()),
                                moveHandle.deltaQ(),
                                moveHandle.deltaR(),
                                moveHandle.deltaLevel());
                case DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch ->
                        new DungeonEditorPreview.MoveBoundaryStretchPreview(
                                stretch.clusterId(),
                                toPublishedEdges(stretch.sourceEdges()),
                                stretch.deltaQ(),
                                stretch.deltaR(),
                                stretch.deltaLevel());
                case DungeonEditorSessionValues.CorridorCreatePreview ignored -> DungeonEditorPreview.none();
                case DungeonEditorSessionValues.DeleteCorridorPreview ignored -> DungeonEditorPreview.none();
                case DungeonEditorSessionValues.NoPreview ignored -> DungeonEditorPreview.none();
            };
        }

    private static List<DungeonEdgeRef> toPublishedEdges(List<DungeonEditorWorkspaceValues.Edge> edges) {
            List<DungeonEdgeRef> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Edge edge : edges == null ? List.<DungeonEditorWorkspaceValues.Edge>of() : edges) {
                result.add(toPublishedEdge(edge));
            }
            return List.copyOf(result);
        }

    private static DungeonEditorViewMode toPublishedViewMode(DungeonEditorSessionValues.@Nullable ViewMode viewMode) {
            return viewMode == DungeonEditorSessionValues.ViewMode.GRAPH
                    ? DungeonEditorViewMode.GRAPH
                    : DungeonEditorViewMode.GRID;
        }

    private static DungeonEditorTool toPublishedTool(DungeonEditorSessionValues.@Nullable Tool tool) {
            return tool == null ? DungeonEditorTool.SELECT : DungeonEditorTool.valueOf(tool.name());
        }

    private static @Nullable DungeonEditorMapProjectionSnapshot projection(
                DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
                DungeonEditorSessionValues.@Nullable Selection selection,
                DungeonEditorSessionValues.@Nullable Preview preview
        ) {
            if (surface == null) {
                return null;
            }
            DungeonEditorSessionValues.Selection safeSelection = selection == null
                    ? DungeonEditorSessionValues.Selection.empty()
                    : selection;
            DungeonEditorSessionValues.Preview safePreview = preview == null
                    ? DungeonEditorSessionValues.Preview.none()
                    : preview;
            ProjectionAccumulator projection = assemble(surface, safeSelection, safePreview);
            DungeonEditorWorkspaceValues.MapSnapshot map = surface.map();
            return new DungeonEditorMapProjectionSnapshot(
                    surface.mapName(),
                    topology(map.topology()),
                    map.width(),
                    map.height(),
                    new DungeonMapProjectionContent<>(
                            projection.cells(),
                            projection.edges(),
                            projection.labels(),
                            projection.markers(),
                            projection.graphNodes(),
                            projection.graphLinks()),
                    null);
        }

    private static ProjectionAccumulator assemble(
                DungeonEditorSessionSnapshot.SurfaceData surface,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview
        ) {
            ProjectionAccumulator projection = new ProjectionAccumulator();
            DungeonEditorWorkspaceValues.MapSnapshot map = surface.map();
            renderAreas(map, selection, projection);
            renderClusterLabels(map, selection, projection.labels);
            addPreviewAndBoundaries(map, selection, preview, surface.previewMap(), projection);
            renderFeatures(map, selection, projection);
            renderHandles(map, selection, preview, projection.markers);
            addPreviewMapDiff(map, selection, preview, surface.previewMap(), projection);
            addFallbackGraphLinks(projection.graphNodes, projection.graphLinks);
            return projection;
        }

    private static void renderAreas(
                DungeonEditorWorkspaceValues.MapSnapshot map,
                DungeonEditorSessionValues.Selection selection,
                ProjectionAccumulator projection
        ) {
            for (DungeonEditorWorkspaceValues.Area area : map.areas()) {
                boolean selected = selectedArea(area, selection);
                List<DungeonEditorMapProjectionSnapshot.CellProjection> areaCells = new ArrayList<>();
                for (DungeonEditorWorkspaceValues.Cell mapCell : area.cells()) {
                    areaCells.add(cell(area, mapCell, selected, false, 0, 0, 0));
                }
                projection.cells.addAll(areaCells);
                if (areaCells.isEmpty()) {
                    continue;
                }
                CellCenter center = centerOf(areaCells);
                projection.graphNodes.add(new DungeonEditorMapProjectionSnapshot.GraphNodeProjection(
                        area.id(),
                        area.clusterId(),
                        area.label(),
                        center.q(),
                        center.r(),
                        selected));
            }
        }

    private static void renderClusterLabels(
                DungeonEditorWorkspaceValues.MapSnapshot map,
                DungeonEditorSessionValues.Selection selection,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels
        ) {
            List<Long> renderedClusterIds = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
                if (!handle.ref().kind().isClusterLabel()) {
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
                DungeonEditorWorkspaceValues.MapSnapshot map,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview,
                DungeonEditorWorkspaceValues.@Nullable MapSnapshot previewMap,
                ProjectionAccumulator projection
        ) {
            addEditorPreview(
                    projection.cells,
                    projection.edges,
                    projection.labels,
                    map.areas(),
                    map.boundaries(),
                    map.editorHandles(),
                    selection,
                    preview,
                    previewMap);
            for (DungeonEditorWorkspaceValues.Boundary boundary : map.boundaries()) {
                if (boundary.edge() == null || boundary.edge().from() == null || boundary.edge().to() == null) {
                    continue;
                }
                projection.edges.add(edge(boundary, 0, 0, 0, false, selectedBoundary(boundary, selection)));
            }
        }

    private static void addPreviewMapDiff(
                DungeonEditorWorkspaceValues.MapSnapshot map,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview,
                DungeonEditorWorkspaceValues.@Nullable MapSnapshot previewMap,
                ProjectionAccumulator projection
        ) {
            if (preview != DungeonEditorSessionValues.Preview.none() || previewMap == null) {
                return;
            }
            addPreviewAreaDiff(projection.cells, projection.labels, map.areas(), previewMap.areas(), selection);
            addPreviewBoundaryDiff(projection.edges, map.boundaries(), previewMap.boundaries(), selection);
            addPreviewHandleDiff(projection.markers, map.editorHandles(), previewMap.editorHandles(), selection);
        }

    private static void renderFeatures(
                DungeonEditorWorkspaceValues.MapSnapshot map,
                DungeonEditorSessionValues.Selection selection,
                ProjectionAccumulator projection
        ) {
            for (DungeonEditorWorkspaceValues.Feature feature : map.features()) {
                boolean selected = selectedFeature(feature, selection);
                List<DungeonEditorMapProjectionSnapshot.CellProjection> featureCells = new ArrayList<>();
                for (DungeonEditorWorkspaceValues.Cell mapCell : feature.cells()) {
                    featureCells.add(featureCell(feature, mapCell, selected));
                }
                projection.cells.addAll(featureCells);
                if (featureCells.isEmpty()) {
                    continue;
                }
                CellCenter center = centerOf(featureCells);
                projection.labels.add(new DungeonEditorMapProjectionSnapshot.LabelProjection(
                        feature.label(),
                        center.q(),
                        center.r(),
                        featureCells.getFirst().level(),
                        feature.id(),
                        0L,
                        safeTopologyRef(feature.topologyRef()),
                        selected,
                        false));
                projection.markers.add(featureMarker(feature, center, featureCells.getFirst().level(), selected));
            }
        }

    private static void renderHandles(
                DungeonEditorWorkspaceValues.MapSnapshot map,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview,
                List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers
        ) {
            for (DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
                if (handle.ref().kind().isClusterLabel()) {
                    continue;
                }
                markers.add(handleMarker(handle, selection, false));
            }
            addHandleMovePreview(markers, preview);
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

    private static void addPreviewAreaDiff(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                List<DungeonEditorWorkspaceValues.Area> committedAreas,
                List<DungeonEditorWorkspaceValues.Area> previewAreas,
                DungeonEditorSessionValues.Selection selection
        ) {
            Map<String, DungeonEditorWorkspaceValues.Area> committedByTopology = indexAreas(committedAreas);
            for (DungeonEditorWorkspaceValues.Area previewArea : previewAreas) {
                DungeonEditorWorkspaceValues.Area committedArea = committedByTopology.remove(topologyKey(previewArea.topologyRef()));
                if (previewArea.equals(committedArea)) {
                    continue;
                }
                addPreviewArea(cells, labels, previewArea, selection, false);
            }
            for (DungeonEditorWorkspaceValues.Area removedArea : committedByTopology.values()) {
                addPreviewArea(cells, labels, removedArea, selection, true);
            }
        }

    private static void addPreviewBoundaryDiff(
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonEditorWorkspaceValues.Boundary> committedBoundaries,
                List<DungeonEditorWorkspaceValues.Boundary> previewBoundaries,
                DungeonEditorSessionValues.Selection selection
        ) {
            Map<String, DungeonEditorWorkspaceValues.Boundary> committedByTopology = indexBoundaries(committedBoundaries);
            for (DungeonEditorWorkspaceValues.Boundary previewBoundary : previewBoundaries) {
                DungeonEditorWorkspaceValues.Boundary committedBoundary =
                        committedByTopology.remove(topologyKey(previewBoundary.topologyRef()));
                if (previewBoundary.equals(committedBoundary)) {
                    continue;
                }
                edges.add(edge(previewBoundary, 0, 0, 0, true, selectedBoundary(previewBoundary, selection)));
            }
            for (DungeonEditorWorkspaceValues.Boundary removedBoundary : committedByTopology.values()) {
                edges.add(edge(removedBoundary, 0, 0, 0, true, selectedBoundary(removedBoundary, selection)));
            }
        }

    private static void addPreviewHandleDiff(
                List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers,
                List<DungeonEditorWorkspaceValues.Handle> committedHandles,
                List<DungeonEditorWorkspaceValues.Handle> previewHandles,
                DungeonEditorSessionValues.Selection selection
        ) {
            Map<String, DungeonEditorWorkspaceValues.Handle> committedByHandle = indexHandles(committedHandles);
            for (DungeonEditorWorkspaceValues.Handle previewHandle : previewHandles) {
                if (previewHandle.ref().kind().isClusterLabel()) {
                    continue;
                }
                DungeonEditorWorkspaceValues.Handle committedHandle =
                        committedByHandle.remove(handleKey(previewHandle.ref()));
                if (previewHandle.equals(committedHandle)) {
                    continue;
                }
                markers.add(handleMarker(previewHandle, selection, true));
            }
            for (DungeonEditorWorkspaceValues.Handle removedHandle : committedByHandle.values()) {
                if (removedHandle.ref().kind().isClusterLabel()) {
                    continue;
                }
                markers.add(handleMarker(removedHandle, selection, true));
            }
        }

    private static void addPreviewArea(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                DungeonEditorWorkspaceValues.Area area,
                DungeonEditorSessionValues.Selection selection,
                boolean destructive
        ) {
            boolean selected = selectedArea(area, selection);
            List<DungeonEditorMapProjectionSnapshot.CellProjection> previewCells = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Cell mapCell : area.cells()) {
                previewCells.add(new DungeonEditorMapProjectionSnapshot.CellProjection(
                        mapCell.q(),
                        mapCell.r(),
                        mapCell.level(),
                        area.label(),
                        area.kind().isCorridor()
                                ? DungeonEditorMapProjectionSnapshot.CellKind.CORRIDOR
                                : DungeonEditorMapProjectionSnapshot.CellKind.ROOM,
                        area.id(),
                        area.clusterId(),
                        safeTopologyRef(area.topologyRef()),
                        selected,
                        false,
                        true,
                        destructive));
            }
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

    private static DungeonEditorMapProjectionSnapshot.CellProjection cell(
                DungeonEditorWorkspaceValues.Area area,
                DungeonEditorWorkspaceValues.Cell mapCell,
                boolean selected,
                boolean preview,
                int deltaQ,
                int deltaR,
                int deltaLevel
        ) {
            DungeonEditorMapProjectionSnapshot.CellKind kind = area.kind().isCorridor()
                    ? DungeonEditorMapProjectionSnapshot.CellKind.CORRIDOR
                    : DungeonEditorMapProjectionSnapshot.CellKind.ROOM;
            return new DungeonEditorMapProjectionSnapshot.CellProjection(
                    mapCell.q() + deltaQ,
                    mapCell.r() + deltaR,
                    mapCell.level() + deltaLevel,
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
                DungeonEditorWorkspaceValues.Feature feature,
                DungeonEditorWorkspaceValues.Cell mapCell,
                boolean selected
        ) {
            DungeonEditorMapProjectionSnapshot.CellKind kind = feature.kind().isTransition()
                    ? DungeonEditorMapProjectionSnapshot.CellKind.TRANSITION
                    : DungeonEditorMapProjectionSnapshot.CellKind.STAIR;
            return new DungeonEditorMapProjectionSnapshot.CellProjection(
                    mapCell.q(),
                    mapCell.r(),
                    mapCell.level(),
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
                DungeonEditorWorkspaceValues.Boundary boundary,
                int deltaQ,
                int deltaR,
                int deltaLevel,
                boolean preview,
                boolean selected
        ) {
            DungeonEditorWorkspaceValues.Edge mapEdge = boundary.edge();
            return new DungeonEditorMapProjectionSnapshot.EdgeProjection(
                    mapEdge.from().q() + deltaQ,
                    mapEdge.from().r() + deltaR,
                    mapEdge.to().q() + deltaQ,
                    mapEdge.to().r() + deltaR,
                    mapEdge.from().level() + deltaLevel,
                    toBoundaryKind(boundary.kind()),
                    boundary.label(),
                    boundary.id(),
                    safeTopologyRef(boundary.topologyRef()),
                    selected,
                    preview);
        }

    private static DungeonEditorMapProjectionSnapshot.MarkerProjection featureMarker(
                DungeonEditorWorkspaceValues.Feature feature,
                CellCenter center,
                int level,
                boolean selected
        ) {
            DungeonEditorMapProjectionSnapshot.MarkerKind kind = feature.kind().isTransition()
                    ? DungeonEditorMapProjectionSnapshot.MarkerKind.WAYPOINT
                    : DungeonEditorMapProjectionSnapshot.MarkerKind.STAIR;
            String label = feature.kind().isTransition() ? "->" : "z";
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
                DungeonEditorWorkspaceValues.Handle handle,
                DungeonEditorSessionValues.Selection selection,
                boolean preview
        ) {
            DungeonEditorWorkspaceValues.HandleRef ref = handle.ref();
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
                DungeonEditorWorkspaceValues.Handle handle,
                boolean selected,
                boolean preview,
                int deltaQ,
                int deltaR,
                int deltaLevel
        ) {
            DungeonEditorWorkspaceValues.Cell mapCell = handle.cell();
            DungeonEditorWorkspaceValues.HandleRef ref = handle.ref();
            return new DungeonEditorMapProjectionSnapshot.LabelProjection(
                    handle.label(),
                    mapCell.q() + deltaQ + 0.5,
                    mapCell.r() + deltaR + 0.5,
                    mapCell.level() + deltaLevel,
                    ref.ownerId(),
                    ref.clusterId(),
                    safeTopologyRef(ref.topologyRef()),
                    selected,
                    preview);
        }

    private static DungeonEditorMapProjectionSnapshot.MarkerKind handleMarkerKind(DungeonEditorHandleType kind) {
            if (kind == DungeonEditorHandleType.DOOR) {
                return DungeonEditorMapProjectionSnapshot.MarkerKind.DOOR;
            }
            if (kind == DungeonEditorHandleType.STAIR_ANCHOR) {
                return DungeonEditorMapProjectionSnapshot.MarkerKind.STAIR;
            }
            return DungeonEditorMapProjectionSnapshot.MarkerKind.WAYPOINT;
        }

    private static String handleMarkerLabel(DungeonEditorHandleType kind) {
            if (kind == DungeonEditorHandleType.DOOR) {
                return "D";
            }
            if (kind == DungeonEditorHandleType.STAIR_ANCHOR) {
                return "z";
            }
            if (kind == DungeonEditorHandleType.CORRIDOR_ANCHOR) {
                return "o";
            }
            if (kind == DungeonEditorHandleType.CORRIDOR_WAYPOINT) {
                return "•";
            }
            return "";
        }

    private static void addEditorPreview(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                List<DungeonEditorWorkspaceValues.Area> areas,
                List<DungeonEditorWorkspaceValues.Boundary> boundaries,
                List<DungeonEditorWorkspaceValues.Handle> handles,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview,
                DungeonEditorWorkspaceValues.@Nullable MapSnapshot previewMap
        ) {
            if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview movePreview) {
                addClusterMovePreview(cells, edges, labels, areas, boundaries, handles, selection, movePreview);
            } else if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview roomRectangle) {
                addRoomRectanglePreview(cells, roomRectangle);
            } else if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaryEdges) {
                addBoundaryEdgesPreview(edges, boundaryEdges);
            } else if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview boundaryStretchMove) {
                addBoundaryStretchPreview(cells, edges, labels, selection, previewMap, boundaryStretchMove);
            }
        }

    private static void addHandleMovePreview(
                List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers,
                DungeonEditorSessionValues.Preview preview
        ) {
            if (!(preview instanceof DungeonEditorSessionValues.MoveHandlePreview movePreview)
                    || movePreview.handleRef().kind().isClusterLabel()) {
                return;
            }
            DungeonEditorWorkspaceValues.HandleRef ref = movePreview.handleRef();
            DungeonEditorWorkspaceValues.Cell mapCell = ref.cell();
            DungeonEditorWorkspaceValues.Cell movedCell = new DungeonEditorWorkspaceValues.Cell(
                    mapCell.q() + movePreview.deltaQ(),
                    mapCell.r() + movePreview.deltaR(),
                    mapCell.level() + movePreview.deltaLevel());
            DungeonEditorWorkspaceValues.HandleRef movedRef = new DungeonEditorWorkspaceValues.HandleRef(
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
                DungeonEditorSessionValues.ClusterBoundariesPreview boundaryEdges
        ) {
            DungeonBoundaryKind kind = toBoundaryKind(boundaryEdges.boundaryKind());
            for (DungeonEditorWorkspaceValues.Edge mapEdge : boundaryEdges.edges()) {
                if (mapEdge == null || mapEdge.from() == null || mapEdge.to() == null) {
                    continue;
                }
                edges.add(new DungeonEditorMapProjectionSnapshot.EdgeProjection(
                        mapEdge.from().q(),
                        mapEdge.from().r(),
                        mapEdge.to().q(),
                        mapEdge.to().r(),
                        mapEdge.from().level(),
                        kind,
                        boundaryEdges.deleteMode() ? "Delete preview" : "Boundary preview",
                        boundaryEdges.clusterId(),
                        DungeonEditorTopologyElementRef.empty(),
                        false,
                        true));
            }
        }

    private static void addRoomRectanglePreview(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                DungeonEditorSessionValues.RoomRectanglePreview roomRectangle
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
                List<DungeonEditorWorkspaceValues.Area> areas,
                List<DungeonEditorWorkspaceValues.Boundary> boundaries,
                List<DungeonEditorWorkspaceValues.Handle> handles,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.MoveHandlePreview movePreview
        ) {
            if (!movePreview.handleRef().kind().isClusterLabel()) {
                return;
            }
            Set<DungeonEditorWorkspaceValues.Cell> draggedCells = new LinkedHashSet<>();
            for (DungeonEditorWorkspaceValues.Area area : areas) {
                if (!draggedClusterArea(area, selection, movePreview)) {
                    continue;
                }
                for (DungeonEditorWorkspaceValues.Cell mapCell : area.cells()) {
                    cells.add(cell(area, mapCell, true, true, movePreview.deltaQ(), movePreview.deltaR(), movePreview.deltaLevel()));
                }
                draggedCells.addAll(area.cells());
            }
            DungeonEditorWorkspaceValues.Handle clusterLabelHandle = clusterLabelHandle(handles, movePreview.handleRef().clusterId());
            if (clusterLabelHandle != null) {
                labels.add(clusterLabel(
                        clusterLabelHandle,
                        true,
                        true,
                        movePreview.deltaQ(),
                        movePreview.deltaR(),
                        movePreview.deltaLevel()));
            }
            previewClusterBoundaries(edges, boundaries, draggedCells, movePreview);
        }

    private static void previewClusterBoundaries(
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonEditorWorkspaceValues.Boundary> boundaries,
                Set<DungeonEditorWorkspaceValues.Cell> draggedCells,
                DungeonEditorSessionValues.MoveHandlePreview movePreview
        ) {
            if (draggedCells.isEmpty()) {
                return;
            }
            for (DungeonEditorWorkspaceValues.Boundary boundary : boundaries) {
                if (boundary.edge() == null
                        || boundary.edge().from() == null
                        || boundary.edge().to() == null
                        || !edgeTouchesAnyCell(boundary.edge(), draggedCells)) {
                    continue;
                }
                edges.add(edge(boundary, movePreview.deltaQ(), movePreview.deltaR(), movePreview.deltaLevel(), true, false));
            }
        }

    private static void addBoundaryStretchPreview(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorWorkspaceValues.@Nullable MapSnapshot previewMap,
                DungeonEditorSessionValues.MoveBoundaryStretchPreview movePreview
        ) {
            if (previewMap == null) {
                return;
            }
            List<DungeonEditorWorkspaceValues.Area> previewAreas = previewAreas(previewMap, movePreview.clusterId());
            if (previewAreas.isEmpty()) {
                return;
            }
            previewAreas(cells, previewAreas, selection);
            DungeonEditorWorkspaceValues.Handle previewHandle = clusterLabelHandle(previewMap.editorHandles(), movePreview.clusterId());
            if (previewHandle != null) {
                labels.add(clusterLabel(previewHandle, true, true, 0, 0, 0));
            }
            previewBoundaries(edges, previewMap.boundaries(), previewClusterCells(previewAreas));
        }

    private static List<DungeonEditorWorkspaceValues.Area> previewAreas(
                DungeonEditorWorkspaceValues.MapSnapshot previewMap,
                long clusterId
        ) {
            List<DungeonEditorWorkspaceValues.Area> result = new ArrayList<>();
            for (DungeonEditorWorkspaceValues.Area area : previewMap.areas()) {
                if (area.kind().isRoom() && area.clusterId() == clusterId) {
                    result.add(area);
                }
            }
            return List.copyOf(result);
        }

    private static void previewAreas(
                List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
                List<DungeonEditorWorkspaceValues.Area> previewAreas,
                DungeonEditorSessionValues.Selection selection
        ) {
            for (DungeonEditorWorkspaceValues.Area area : previewAreas) {
                for (DungeonEditorWorkspaceValues.Cell mapCell : area.cells()) {
                    cells.add(cell(area, mapCell, selectedArea(area, selection), true, 0, 0, 0));
                }
            }
        }

    private static Set<DungeonEditorWorkspaceValues.Cell> previewClusterCells(
                List<DungeonEditorWorkspaceValues.Area> previewAreas
        ) {
            Set<DungeonEditorWorkspaceValues.Cell> result = new LinkedHashSet<>();
            for (DungeonEditorWorkspaceValues.Area area : previewAreas) {
                result.addAll(area.cells());
            }
            return Set.copyOf(result);
        }

    private static void previewBoundaries(
                List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
                List<DungeonEditorWorkspaceValues.Boundary> boundaries,
                Set<DungeonEditorWorkspaceValues.Cell> previewClusterCells
        ) {
            for (DungeonEditorWorkspaceValues.Boundary boundary : boundaries) {
                if (boundary.edge() == null
                        || boundary.edge().from() == null
                        || boundary.edge().to() == null
                        || !edgeTouchesAnyCell(boundary.edge(), previewClusterCells)) {
                    continue;
                }
                edges.add(edge(boundary, 0, 0, 0, true, false));
            }
        }

    private static boolean selectedArea(
                DungeonEditorWorkspaceValues.@Nullable Area area,
                DungeonEditorSessionValues.@Nullable Selection selection
        ) {
            if (area == null || selection == null) {
                return false;
            }
            if (selection.clusterSelection()) {
                return area.kind().isRoom() && area.clusterId() == selection.clusterId();
            }
            return safeTopologyRef(area.topologyRef()).equals(safeTopologyRef(selection.topologyRef()));
        }

    private static boolean selectedFeature(
                DungeonEditorWorkspaceValues.@Nullable Feature feature,
                DungeonEditorSessionValues.@Nullable Selection selection
        ) {
            return feature != null
                    && selection != null
                    && safeTopologyRef(feature.topologyRef()).equals(safeTopologyRef(selection.topologyRef()));
        }

    private static boolean selectedBoundary(
                DungeonEditorWorkspaceValues.@Nullable Boundary boundary,
                DungeonEditorSessionValues.@Nullable Selection selection
        ) {
            return boundary != null
                    && selection != null
                    && safeTopologyRef(boundary.topologyRef()).equals(safeTopologyRef(selection.topologyRef()));
        }

    private static boolean selectedHandle(
                DungeonEditorWorkspaceValues.@Nullable HandleRef ref,
                DungeonEditorSessionValues.@Nullable Selection selection
        ) {
            if (ref == null
                    || selection == null
                    || selection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef())) {
                return false;
            }
            DungeonEditorWorkspaceValues.HandleRef selected = selection.handleRef();
            return ref.kind() == selected.kind()
                    && safeTopologyRef(ref.topologyRef()).equals(safeTopologyRef(selected.topologyRef()))
                    && ref.ownerId() == selected.ownerId()
                    && ref.clusterId() == selected.clusterId()
                    && ref.corridorId() == selected.corridorId()
                    && ref.roomId() == selected.roomId()
                    && ref.index() == selected.index();
        }

    private static boolean selectedClusterLabel(
                DungeonEditorWorkspaceValues.@Nullable Handle handle,
                DungeonEditorSessionValues.@Nullable Selection selection
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
                DungeonEditorWorkspaceValues.@Nullable Area area,
                DungeonEditorSessionValues.@Nullable Selection selection,
                DungeonEditorSessionValues.MoveHandlePreview movePreview
        ) {
            if (area == null || !movePreview.handleRef().kind().isClusterLabel()) {
                return false;
            }
            long selectedClusterId = selection == null || selection.clusterId() <= 0L
                    ? movePreview.handleRef().clusterId()
                    : selection.clusterId();
            return selectedClusterId > 0L && area.kind().isRoom() && area.clusterId() == selectedClusterId;
        }

    private static boolean edgeTouchesAnyCell(
                DungeonEditorWorkspaceValues.Edge mapEdge,
                Set<DungeonEditorWorkspaceValues.Cell> cells
        ) {
            return mapEdge != null && DungeonEditorBoundaryTouchGeometry.fromEdge(mapEdge).touchingCount(cells) > 0;
        }

    private static CellCenter centerOf(List<DungeonEditorMapProjectionSnapshot.CellProjection> cells) {
            double q = 0.0;
            double r = 0.0;
            for (DungeonEditorMapProjectionSnapshot.CellProjection mapCell : cells) {
                q += mapCell.q() + 0.5;
                r += mapCell.r() + 0.5;
            }
            int count = Math.max(1, cells.size());
            return new CellCenter(q / count, r / count);
        }

    private static Map<String, DungeonEditorWorkspaceValues.Area> indexAreas(
                List<DungeonEditorWorkspaceValues.Area> areas
        ) {
            Map<String, DungeonEditorWorkspaceValues.Area> result = new LinkedHashMap<>();
            for (DungeonEditorWorkspaceValues.Area area : areas) {
                result.put(topologyKey(area.topologyRef()), area);
            }
            return result;
        }

    private static Map<String, DungeonEditorWorkspaceValues.Boundary> indexBoundaries(
                List<DungeonEditorWorkspaceValues.Boundary> boundaries
        ) {
            Map<String, DungeonEditorWorkspaceValues.Boundary> result = new LinkedHashMap<>();
            for (DungeonEditorWorkspaceValues.Boundary boundary : boundaries) {
                result.put(topologyKey(boundary.topologyRef()), boundary);
            }
            return result;
        }

    private static Map<String, DungeonEditorWorkspaceValues.Handle> indexHandles(
                List<DungeonEditorWorkspaceValues.Handle> handles
        ) {
            Map<String, DungeonEditorWorkspaceValues.Handle> result = new LinkedHashMap<>();
            for (DungeonEditorWorkspaceValues.Handle handle : handles) {
                result.put(handleKey(handle.ref()), handle);
            }
            return result;
        }

    private static DungeonEditorWorkspaceValues.@Nullable Handle clusterLabelHandle(
                @Nullable List<DungeonEditorWorkspaceValues.Handle> handles,
                long clusterId
        ) {
            if (handles == null || clusterId <= 0L) {
                return null;
            }
            for (DungeonEditorWorkspaceValues.Handle handle : handles) {
                if (handle != null && handle.ref().kind().isClusterLabel() && handle.ref().clusterId() == clusterId) {
                    return handle;
                }
            }
            return null;
        }

    private static String topologyKey(@Nullable DungeonTopologyRef topologyRef) {
            DungeonTopologyRef safeRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            return safeRef.kind().name() + ":" + safeRef.id();
        }

    private static String handleKey(DungeonEditorWorkspaceValues.@Nullable HandleRef handleRef) {
            DungeonEditorWorkspaceValues.HandleRef safeRef = handleRef == null
                    ? emptyWorkspaceHandleRef(0L, 0L)
                    : handleRef;
            return safeRef.kind().name()
                    + ":" + topologyKey(safeRef.topologyRef())
                    + ":" + safeRef.ownerId()
                    + ":" + safeRef.clusterId()
                    + ":" + safeRef.corridorId()
                    + ":" + safeRef.roomId()
                    + ":" + safeRef.index();
        }

    private static DungeonTopologyKind topology(DungeonTopology topology) {
            return topology != null && topology.isHex() ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
        }

    private static DungeonEditorTopologyElementRef safeTopologyRef(@Nullable DungeonTopologyRef ref) {
            return toPublishedTopologyRef(ref == null ? DungeonTopologyRef.empty() : ref);
        }

    private static DungeonEditorHandleRef emptyHandleRef(long ownerId, long clusterId) {
            return toPublishedHandleRefOrEmpty(emptyWorkspaceHandleRef(ownerId, clusterId));
        }

    private static DungeonEditorWorkspaceValues.HandleRef emptyWorkspaceHandleRef(long ownerId, long clusterId) {
            return new DungeonEditorWorkspaceValues.HandleRef(
                    DungeonEditorHandleType.CLUSTER_LABEL,
                    DungeonTopologyRef.empty(),
                    ownerId,
                    clusterId,
                    0L,
                    0L,
                    0,
                    DungeonEditorWorkspaceValues.Cell.empty(),
                    "");
        }

    private static DungeonEditorTopologyElementRef toPublishedTopologyRef(@Nullable DungeonTopologyRef ref) {
            return ref == null ? DungeonEditorTopologyElementRef.empty() : new DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
        }

    private static DungeonEditorHandleRef toPublishedHandleRefOrEmpty(
                DungeonEditorWorkspaceValues.@Nullable HandleRef handleRef
        ) {
            if (handleRef == null) {
                return DungeonEditorHandleRef.empty();
            }
            return new DungeonEditorHandleRef(
                    DungeonEditorHandleKind.valueOf(handleRef.kind().name()),
                    toDomainTopologyRef(handleRef.topologyRef()),
                    handleRef.ownerId(),
                    handleRef.clusterId(),
                    handleRef.corridorId(),
                    handleRef.roomId(),
                    handleRef.index(),
                    toPublishedCell(handleRef.cell()),
                    handleRef.direction());
        }

    private static DungeonTopologyElementRef toDomainTopologyRef(@Nullable DungeonTopologyRef ref) {
            return ref == null
                    ? DungeonTopologyElementRef.empty()
                    : new DungeonTopologyElementRef(DungeonTopologyElementKind.valueOf(ref.kind().name()), ref.id());
        }

    private static DungeonCellRef toPublishedCell(DungeonEditorWorkspaceValues.@Nullable Cell mapCell) {
            return mapCell == null ? new DungeonCellRef(0, 0, 0) : new DungeonCellRef(mapCell.q(), mapCell.r(), mapCell.level());
        }

    private static DungeonEdgeRef toPublishedEdge(DungeonEditorWorkspaceValues.@Nullable Edge mapEdge) {
            if (mapEdge == null) {
                return new DungeonEdgeRef(new DungeonCellRef(0, 0, 0), new DungeonCellRef(0, 0, 0));
            }
            return new DungeonEdgeRef(toPublishedCell(mapEdge.from()), toPublishedCell(mapEdge.to()));
        }

    private static DungeonBoundaryKind toBoundaryKind(DungeonEditorWorkspaceValues.@Nullable BoundaryKind kind) {
            DungeonEditorWorkspaceValues.BoundaryKind safeKind = kind == null
                    ? DungeonEditorWorkspaceValues.BoundaryKind.defaultKind()
                    : kind;
            return DungeonBoundaryKind.valueOf(safeKind.name());
        }

    private record CellCenter(double q, double r) {
        }

    private static final class ProjectionAccumulator {
        private final List<DungeonEditorMapProjectionSnapshot.CellProjection> cells = new ArrayList<>();
        private final List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges = new ArrayList<>();
        private final List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels = new ArrayList<>();
        private final List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers = new ArrayList<>();
        private final List<DungeonEditorMapProjectionSnapshot.GraphNodeProjection> graphNodes = new ArrayList<>();
        private final List<DungeonEditorMapProjectionSnapshot.GraphLinkProjection> graphLinks = new ArrayList<>();

        private List<DungeonEditorMapProjectionSnapshot.CellProjection> cells() {
                return List.copyOf(cells);
            }

        private List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges() {
                return List.copyOf(edges);
            }

        private List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels() {
                return List.copyOf(labels);
            }

        private List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers() {
                return List.copyOf(markers);
            }

        private List<DungeonEditorMapProjectionSnapshot.GraphNodeProjection> graphNodes() {
                return List.copyOf(graphNodes);
            }

        private List<DungeonEditorMapProjectionSnapshot.GraphLinkProjection> graphLinks() {
                return List.copyOf(graphLinks);
            }
        }

}
