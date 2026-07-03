package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.MapSurfaceFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedBoundaryKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewBoundaryEdgeFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewRenderFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewStairCellFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewStairMarkerFrame;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.CellKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.EdgeKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.MarkerKind;

final class DungeonMapSnapshotProjectionContentPartModel {
    DungeonMapContentModel.DungeonMapRenderState mapEditorSurface(
            String placeholderTitle,
            MapSurfaceFrame frame,
            DungeonMapContentModel.MapInteractionFrame interactionFrame,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel
    ) {
        MapSurfaceFrame safeFrame = frame == null
                ? MapSurfaceFrame.empty()
                : frame;
        DungeonMapContentModel.DungeonMapRenderState baseState = mapEditorRenderState(
                placeholderTitle,
                safeFrame.surface(),
                safeFrame.selection(),
                safeFrame.previewRender(),
                safeFrame.previewRenderDiff(),
                interactionFrame,
                roomLabelPlacementContentPartModel,
                previewDiffContentPartModel,
                true);
        return baseState.withViewMode(
                        DungeonMapContentModel.DungeonMapRenderState.ViewMode.fromEditor(safeFrame.viewMode()))
                .withOverlaySettings(toOverlaySettings(safeFrame.overlaySettings()))
                .withProjectionLevel(safeFrame.projectionLevel())
                .withSelectedTool(toolLabel(safeFrame.selectedTool()));
    }

    DungeonMapContentModel.DungeonMapRenderState mapTravel(
            String placeholderTitle,
            TravelDungeonSnapshot snapshot,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
    ) {
        TravelDungeonSnapshot safeSnapshot = snapshot == null
                ? TravelDungeonSnapshot.empty()
                : snapshot;
        DungeonMapContentModel.DungeonMapRenderState baseState = mapTravelSurface(
                placeholderTitle,
                safeSnapshot.travelSurface(),
                roomLabelPlacementContentPartModel);
        return baseState.withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(DungeonMapContentModel.DungeonMapRenderState.selectToolLabel());
    }

    private static DungeonMapContentModel.DungeonMapRenderState.LevelOverlaySettings toOverlaySettings(
            DungeonOverlaySettings overlaySettings
    ) {
        DungeonOverlaySettings safeOverlay = overlaySettings == null
                ? DungeonOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonMapContentModel.DungeonMapRenderState.LevelOverlaySettings(
                DungeonMapContentModel.DungeonMapRenderState.OverlayMode.fromKey(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static String toolLabel(DungeonEditorTool selectedTool) {
        return DungeonEditorTool.labelFor(selectedTool);
    }

    private static DungeonMapContentModel.DungeonMapRenderState mapTravelSurface(
            String placeholderTitle,
            @Nullable DungeonTravelSurfaceSnapshot surface,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
    ) {
        if (surface == null) {
            return DungeonMapContentModel.DungeonMapRenderState.empty(placeholderTitle, false);
        }
        DungeonMapSnapshot map = surface.map();
        List<DungeonMapContentModel.DungeonMapRenderState.GraphNode> graphNodes = travelGraphNodes(map.areas());
        return new DungeonMapContentModel.DungeonMapRenderState(
                surface.mapName(),
                true,
                map.width(),
                map.height(),
                DungeonMapContentModel.DungeonMapRenderState.Topology.fromPublished(map.topology()),
                DungeonMapContentModel.DungeonMapRenderState.ViewMode.grid(),
                DungeonMapContentModel.DungeonMapRenderState.LevelOverlaySettings.off(),
                0,
                false,
                DungeonMapContentModel.DungeonMapRenderState.selectToolLabel(),
                "No dungeon map geometry available.",
                travelCells(map),
                travelEdges(map.boundaries()),
                travelLabels(
                        map.areas(),
                        map.features(),
                        roomLabelPlacementContentPartModel),
                travelMarkers(map.features()),
                graphNodes,
                travelFallbackGraphLinks(graphNodes),
                travelPartyToken(surface));
    }

    private static List<DungeonMapContentModel.DungeonMapRenderState.Cell> travelCells(DungeonMapSnapshot map) {
        List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells = new ArrayList<>();
        for (DungeonAreaSnapshot area : map.areas()) {
            appendTravelAreaCells(cells, area);
        }
        for (DungeonFeatureSnapshot feature : map.features()) {
            for (DungeonCellRef cell : feature.cells()) {
                cells.add(new DungeonMapContentModel.DungeonMapRenderState.Cell(
                        cell.q(),
                        cell.r(),
                        cell.level(),
                        feature.label(),
                        DungeonMapEditorProjectionContentPartModel.featureCellKind(feature.kind()),
                        feature.id(),
                        0L,
                        DungeonMapEditorProjectionContentPartModel.topologyRef(feature.topologyRef()),
                        false,
                        false,
                        false,
                        false));
            }
        }
        return List.copyOf(cells);
    }

    private static List<DungeonMapContentModel.DungeonMapRenderState.Cell> travelAreaCells(
            DungeonAreaSnapshot area
    ) {
        List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells = new ArrayList<>();
        appendTravelAreaCells(cells, area);
        return List.copyOf(cells);
    }

    private static void appendTravelAreaCells(
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
            DungeonAreaSnapshot area
    ) {
        for (DungeonCellRef cell : area.cells()) {
            cells.add(new DungeonMapContentModel.DungeonMapRenderState.Cell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    area.label(),
                    area.kind() == DungeonAreaKind.CORRIDOR
                            ? CellKind.CORRIDOR
                            : CellKind.ROOM,
                    area.id(),
                    area.clusterId(),
                    DungeonMapEditorProjectionContentPartModel.topologyRef(area.topologyRef()),
                    false,
                    false,
                    false,
                    false));
        }
    }

    private static List<DungeonMapContentModel.DungeonMapRenderState.Edge> travelEdges(
            List<DungeonBoundarySnapshot> boundaries
    ) {
        List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges = new ArrayList<>();
        for (DungeonBoundarySnapshot boundary : boundaries) {
            edges.add(new DungeonMapContentModel.DungeonMapRenderState.Edge(
                    boundary.edge().from().q(),
                    boundary.edge().from().r(),
                    boundary.edge().to().q(),
                    boundary.edge().to().r(),
                    boundary.edge().from().level(),
                    "door".equalsIgnoreCase(boundary.kind())
                            ? EdgeKind.DOOR
                            : EdgeKind.WALL,
                    boundary.label(),
                    boundary.id(),
                    DungeonMapEditorProjectionContentPartModel.topologyRef(boundary.topologyRef()),
                    false,
                    false));
        }
        return List.copyOf(edges);
    }

    private static List<DungeonMapContentModel.DungeonMapRenderState.Label> travelLabels(
            List<DungeonAreaSnapshot> areas,
            List<DungeonFeatureSnapshot> features,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
    ) {
        List<DungeonMapContentModel.DungeonMapRenderState.Label> labels = new ArrayList<>();
        for (DungeonAreaSnapshot area : areas) {
            if (area.kind() == DungeonAreaKind.CORRIDOR) {
                continue;
            }
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> areaCells = travelAreaCells(area);
            if (areaCells.isEmpty()) {
                continue;
            }
            labels.add(DungeonMapEditorProjectionContentPartModel.roomLabel(
                    area.label(),
                    area.id(),
                    area.clusterId(),
                    DungeonMapEditorProjectionContentPartModel.topologyRef(area.topologyRef()),
                    areaCells,
                    roomLabelPlacementContentPartModel,
                    false,
                    false));
        }
        return List.copyOf(labels);
    }

    private static List<DungeonMapContentModel.DungeonMapRenderState.Marker> travelMarkers(
            List<DungeonFeatureSnapshot> features
    ) {
        List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers = new ArrayList<>();
        for (DungeonFeatureSnapshot feature : features) {
            if (!travelMarkerPlacementPresent(feature)) {
                continue;
            }
            CellCenter center = travelMarkerCenter(feature);
            DungeonEdgeRef anchorEdge = feature.anchorEdge();
            double markerQ = center.q();
            double markerR = center.r();
            if (!DungeonMapEditorProjectionContentPartModel.invalidEdge(anchorEdge)) {
                markerQ = (anchorEdge.from().q() + anchorEdge.to().q()) / 2.0;
                markerR = (anchorEdge.from().r() + anchorEdge.to().r()) / 2.0;
            }
            markers.add(new DungeonMapContentModel.DungeonMapRenderState.Marker(
                    DungeonMapEditorProjectionContentPartModel.featureMarkerLabel(feature.kind()),
                    markerQ,
                    markerR,
                    center.level(),
                    DungeonMapEditorProjectionContentPartModel.featureMarkerKind(feature.kind()),
                    false,
                    travelMarkerHandle(feature, center),
                    false,
                    DungeonMapEditorProjectionContentPartModel.invalidEdge(anchorEdge) ? null : anchorEdge,
                    feature.label()));
        }
        return List.copyOf(markers);
    }

    private static boolean travelMarkerPlacementPresent(DungeonFeatureSnapshot feature) {
        return feature != null
                && (!feature.cells().isEmpty()
                || !DungeonMapEditorProjectionContentPartModel.invalidEdge(feature.anchorEdge()));
    }

    private static CellCenter travelMarkerCenter(DungeonFeatureSnapshot feature) {
        DungeonEdgeRef anchorEdge = feature.anchorEdge();
        if (!DungeonMapEditorProjectionContentPartModel.invalidEdge(anchorEdge)) {
            return new CellCenter(
                    (anchorEdge.from().q() + anchorEdge.to().q()) / 2.0,
                    (anchorEdge.from().r() + anchorEdge.to().r()) / 2.0,
                    anchorEdge.from().level());
        }
        return centerOf(feature.cells());
    }

    private static DungeonMapContentModel.DungeonMapRenderState.MarkerHandle travelMarkerHandle(
            DungeonFeatureSnapshot feature,
            CellCenter center
    ) {
        int q = (int) Math.floor(center.q());
        int r = (int) Math.floor(center.r());
        int level = center.level();
        if (feature.kind() != DungeonFeatureKind.TRANSITION) {
            return DungeonMapEditorProjectionContentPartModel.markerHandle(q, r, level);
        }
        return DungeonMapEditorProjectionContentPartModel.markerHandle(
                DungeonMapEditorProjectionContentPartModel.topologyRef(feature.topologyRef()),
                q,
                r,
                level);
    }

    private static List<DungeonMapContentModel.DungeonMapRenderState.GraphNode> travelGraphNodes(
            List<DungeonAreaSnapshot> areas
    ) {
        List<DungeonMapContentModel.DungeonMapRenderState.GraphNode> nodes = new ArrayList<>();
        for (DungeonAreaSnapshot area : areas) {
            if (area.cells().isEmpty()) {
                continue;
            }
            CellCenter center = centerOf(area.cells());
            nodes.add(new DungeonMapContentModel.DungeonMapRenderState.GraphNode(
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    center.q(),
                    center.r(),
                    false));
        }
        return List.copyOf(nodes);
    }

    private static List<DungeonMapContentModel.DungeonMapRenderState.GraphLink> travelFallbackGraphLinks(
            List<DungeonMapContentModel.DungeonMapRenderState.GraphNode> nodes
    ) {
        int maximumLinklessGraphNodeCount = 1;
        if (nodes.size() <= maximumLinklessGraphNodeCount) {
            return List.of();
        }
        List<DungeonMapContentModel.DungeonMapRenderState.GraphLink> links = new ArrayList<>();
        for (int index = 1; index < nodes.size(); index++) {
            links.add(new DungeonMapContentModel.DungeonMapRenderState.GraphLink(
                    nodes.get(index - 1).id(),
                    nodes.get(index).id(),
                    false));
        }
        return List.copyOf(links);
    }

    private static DungeonMapContentModel.DungeonMapRenderState.PartyToken travelPartyToken(
            DungeonTravelSurfaceSnapshot surface
    ) {
        if (surface.position() == null) {
            return null;
        }
        DungeonCellRef tile = surface.position().tile();
        return new DungeonMapContentModel.DungeonMapRenderState.PartyToken(
                tile.q() + 0.5,
                tile.r() + 0.5,
                tile.level(),
                DungeonMapContentModel.DungeonMapRenderState.Heading.fromEditor(surface.position().heading()),
                true);
    }

    private static CellCenter centerOf(List<DungeonCellRef> cells) {
        if (cells == null || cells.isEmpty()) {
            return new CellCenter(0.5, 0.5, 0);
        }
        double q = 0.0;
        double r = 0.0;
        int level = cells.getFirst().level();
        for (DungeonCellRef cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        return new CellCenter(q / cells.size(), r / cells.size(), level);
    }

    private static DungeonMapContentModel.DungeonMapRenderState mapEditorRenderState(
            String placeholderTitle,
            @Nullable DungeonEditorSurface surface,
            DungeonEditorStateSnapshot.Selection selection,
            PreviewRenderFrame previewRender,
            PreviewRenderDiffFrame previewRenderDiff,
            DungeonMapContentModel.MapInteractionFrame interactionFrame,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel,
            boolean editorMode
    ) {
        if (surface == null) {
            return DungeonMapContentModel.DungeonMapRenderState.empty(placeholderTitle, editorMode);
        }
        DungeonEditorMapSnapshot map = surface.map();
        ProjectionAccumulator projection = assemble(
                map,
                previewRender == null ? PreviewRenderFrame.empty() : previewRender,
                previewRenderDiff,
                selection == null ? DungeonEditorStateSnapshot.Selection.empty() : selection,
                interactionFrame == null ? DungeonMapContentModel.MapInteractionFrame.empty() : interactionFrame,
                roomLabelPlacementContentPartModel,
                previewDiffContentPartModel == null
                        ? new DungeonMapPreviewDiffContentPartModel()
                        : previewDiffContentPartModel);
        return projection.renderState(surface, map, editorMode);
    }

    private static ProjectionAccumulator assemble(
            DungeonEditorMapSnapshot map,
            PreviewRenderFrame previewRender,
            PreviewRenderDiffFrame previewRenderDiff,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapContentModel.MapInteractionFrame interactionFrame,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel
    ) {
        ProjectionAccumulator projection = new ProjectionAccumulator();
        projection.addAreas(map, selection, roomLabelPlacementContentPartModel);
        projection.addClusterLabels(map, selection);
        projection.addPreviewAndBoundaries(map, selection, previewRender);
        projection.addFeatures(map, selection);
        projection.addHandles(map, selection, interactionFrame);
        projection.addPreviewRenderDiff(
                previewDiffContentPartModel,
                previewRenderDiff,
                selection,
                interactionFrame,
                roomLabelPlacementContentPartModel);
        projection.addFallbackGraphLinks();
        return projection;
    }

    private record CellCenter(double q, double r, int level) {
    }

    private interface PreparedPreviewProjection {

        static void addPreparedPreview(
                List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
                List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges,
                List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
                List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
                PreviewRenderFrame previewRender
        ) {
            PreviewRenderFrame safePreviewRender = previewRender == null ? PreviewRenderFrame.empty() : previewRender;
            for (PreviewBoundaryEdgeFrame boundaryEdge : safePreviewRender.boundaryEdges()) {
                addBoundaryEdgesPreview(edges, boundaryEdge);
            }
            for (PreviewStairCellFrame stairCell : safePreviewRender.stairCells()) {
                addStairDraftCell(cells, labels, stairCell);
            }
            addStairMarker(markers, safePreviewRender.stairMarker());
        }

        static void addBoundaryEdgesPreview(
                List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges,
                PreviewBoundaryEdgeFrame boundaryEdge
        ) {
            if (boundaryEdge == null) {
                return;
            }
            edges.add(new DungeonMapContentModel.DungeonMapRenderState.Edge(
                    boundaryEdge.fromQ(),
                    boundaryEdge.fromR(),
                    boundaryEdge.toQ(),
                    boundaryEdge.toR(),
                    boundaryEdge.level(),
                    boundaryKind(boundaryEdge.boundaryKind()),
                    boundaryEdge.label(),
                    boundaryEdge.clusterId(),
                    DungeonMapContentModel.DungeonMapRenderState.TopologyRef.empty(),
                    false,
                    true));
        }

        static void addStairDraftCell(
                List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
                List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
                PreviewStairCellFrame stairCell
        ) {
            if (stairCell == null || !stairCell.present()) {
                return;
            }
            cells.add(new DungeonMapContentModel.DungeonMapRenderState.Cell(
                    stairCell.q(),
                    stairCell.r(),
                    stairCell.level(),
                    stairCell.label(),
                    CellKind.STAIR,
                    0L,
                    0L,
                    DungeonMapContentModel.DungeonMapRenderState.TopologyRef.empty(),
                    false,
                    false,
                    true,
                    false));
            DungeonMapStairPreviewLevelLabelContentPartModel.addLevelLabel(
                    labels,
                    new DungeonCellRef(stairCell.q(), stairCell.r(), stairCell.level()),
                    0L,
                    DungeonMapContentModel.DungeonMapRenderState.TopologyRef.empty());
        }

        static void addStairMarker(
                List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
                PreviewStairMarkerFrame stairMarker
        ) {
            if (stairMarker == null || !stairMarker.present()) {
                return;
            }
            markers.add(new DungeonMapContentModel.DungeonMapRenderState.Marker(
                    stairMarker.label(),
                    stairMarker.q() + 0.5,
                    stairMarker.r() + 0.5,
                    stairMarker.level(),
                    MarkerKind.STAIR,
                    false,
                    DungeonMapEditorProjectionContentPartModel.markerHandle(
                            stairMarker.q(),
                            stairMarker.r(),
                            stairMarker.level()),
                    true));
        }
    }

    private static DungeonMapContentModel.DungeonMapRenderState.EdgeKind boundaryKind(PreparedBoundaryKind kind) {
        return kind == PreparedBoundaryKind.DOOR
                ? EdgeKind.DOOR
                : EdgeKind.WALL;
    }

    private static final class ProjectionAccumulator {
        private final List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells = new ArrayList<>();
        private final List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges = new ArrayList<>();
        private final List<DungeonMapContentModel.DungeonMapRenderState.Label> labels = new ArrayList<>();
        private final List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers = new ArrayList<>();
        private final List<DungeonMapContentModel.DungeonMapRenderState.GraphNode> graphNodes = new ArrayList<>();
        private final List<DungeonMapContentModel.DungeonMapRenderState.GraphLink> graphLinks = new ArrayList<>();

        private void addAreas(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
        ) {
            for (DungeonEditorMapSnapshot.Area area : map.areas()) {
                addArea(
                        area,
                        DungeonMapEditorProjectionContentPartModel.selectedAreaSurface(area, selection),
                        DungeonMapEditorProjectionContentPartModel.selectedArea(area, selection),
                        roomLabelPlacementContentPartModel);
            }
        }

        private void addArea(
                DungeonEditorMapSnapshot.Area area,
                boolean surfaceSelected,
                boolean annotationSelected,
                DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
        ) {
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> areaCells = new ArrayList<>();
            for (DungeonCellRef cell : area.cells()) {
                areaCells.add(DungeonMapEditorProjectionContentPartModel.cell(
                        area,
                        cell,
                        surfaceSelected,
                        false,
                        false,
                        0,
                        0,
                        0));
            }
            cells.addAll(areaCells);
            if (areaCells.isEmpty()) {
                return;
            }
            DungeonMapEditorProjectionContentPartModel.CellCenter center =
                    DungeonMapEditorProjectionContentPartModel.centerOfCells(areaCells);
            graphNodes.add(new DungeonMapContentModel.DungeonMapRenderState.GraphNode(
                    area.id(),
                    DungeonMapEditorProjectionContentPartModel.clusterId(area),
                    area.label(),
                    center.q(),
                    center.r(),
                    annotationSelected));
            if (areaCells.getFirst().kind() == CellKind.ROOM) {
                labels.add(DungeonMapEditorProjectionContentPartModel.roomLabel(
                        area,
                        areaCells,
                        roomLabelPlacementContentPartModel,
                        annotationSelected,
                        false));
            }
        }

        private void addClusterLabels(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection
        ) {
            List<Long> renderedClusterIds = new ArrayList<>();
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                if (!handle.ref().kind().isClusterLabel()) {
                    continue;
                }
                long clusterId = handle.ref().clusterId();
                if (clusterId <= 0L || renderedClusterIds.contains(clusterId)) {
                    continue;
                }
                renderedClusterIds.add(clusterId);
                labels.add(DungeonMapEditorProjectionContentPartModel.clusterLabel(
                        handle,
                        DungeonMapEditorProjectionContentPartModel.selectedClusterLabel(handle, selection),
                        false,
                        0,
                        0,
                        0));
            }
        }

        private void addPreviewAndBoundaries(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                PreviewRenderFrame previewRender
        ) {
            PreparedPreviewProjection.addPreparedPreview(cells, edges, labels, markers, previewRender);
            for (DungeonEditorMapSnapshot.Boundary boundary : map.boundaries()) {
                if (DungeonMapEditorProjectionContentPartModel.invalidEdge(boundary.edge())) {
                    continue;
                }
                edges.add(DungeonMapEditorProjectionContentPartModel.edge(
                        boundary,
                        0,
                        0,
                        0,
                        false,
                        DungeonMapEditorProjectionContentPartModel.selectedBoundary(boundary, selection)));
            }
        }

        private void addFeatures(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection
        ) {
            for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
                addFeature(feature, DungeonMapEditorProjectionContentPartModel.selectedFeature(feature, selection));
            }
        }

        private void addFeature(
                DungeonEditorMapSnapshot.Feature feature,
                boolean selected
        ) {
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> featureCells = new ArrayList<>();
            for (DungeonCellRef cell : feature.cells()) {
                featureCells.add(DungeonMapEditorProjectionContentPartModel.featureCell(feature, cell, selected));
            }
            cells.addAll(featureCells);
            if (!DungeonMapEditorProjectionContentPartModel.hasFeatureMarkerPlacement(feature, featureCells)) {
                return;
            }
            DungeonMapEditorProjectionContentPartModel.CellCenter center =
                    DungeonMapEditorProjectionContentPartModel.featureMarkerCenter(feature, featureCells);
            markers.add(DungeonMapEditorProjectionContentPartModel.featureMarker(
                    feature,
                    center,
                    DungeonMapEditorProjectionContentPartModel.featureMarkerLevel(feature, featureCells),
                    selected));
        }

        private void addHandles(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonMapContentModel.MapInteractionFrame interactionFrame
        ) {
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                if (!runtimePreparedHandle(handle, interactionFrame)) {
                    continue;
                }
                markers.add(DungeonMapEditorProjectionContentPartModel.handleMarker(handle, selection, false));
            }
        }

        private static boolean runtimePreparedHandle(
                DungeonEditorHandleSnapshot handle,
                DungeonMapContentModel.MapInteractionFrame interactionFrame
        ) {
            String hitRef = DungeonEditorMapHitRef.marker(handle.ref(), handle.cell()).value();
            if (hitRef.isBlank()) {
                return false;
            }
            DungeonMapContentModel.PointerTarget target = interactionFrame.pointerTargets().get(hitRef);
            return target != null
                    && target.isHandleTarget()
                    && DungeonMapEditorProjectionContentPartModel.sameHandleRef(handle.ref(), target.handleRef());
        }

        private void addPreviewRenderDiff(
                DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel,
                PreviewRenderDiffFrame previewRenderDiff,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonMapContentModel.MapInteractionFrame interactionFrame,
                DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
        ) {
            previewDiffContentPartModel.addPreviewRenderDiff(
                    cells,
                    edges,
                    labels,
                    markers,
                    previewRenderDiff,
                    interactionFrame,
                    selection,
                    roomLabelPlacementContentPartModel);
        }

        private void addFallbackGraphLinks() {
            if (!graphLinks.isEmpty() || graphNodes.size() <= 1) {
                return;
            }
            for (int index = 1; index < graphNodes.size(); index++) {
                graphLinks.add(new DungeonMapContentModel.DungeonMapRenderState.GraphLink(
                        graphNodes.get(index - 1).id(),
                        graphNodes.get(index).id(),
                        false));
            }
        }

        private DungeonMapContentModel.DungeonMapRenderState renderState(
                DungeonEditorSurface surface,
                DungeonEditorMapSnapshot map,
                boolean editorMode
        ) {
            return new DungeonMapContentModel.DungeonMapRenderState(
                    surface.mapName(),
                    true,
                    map.width(),
                    map.height(),
                    DungeonMapContentModel.DungeonMapRenderState.Topology.fromName(map.topology()),
                    DungeonMapContentModel.DungeonMapRenderState.ViewMode.grid(),
                    DungeonMapContentModel.DungeonMapRenderState.LevelOverlaySettings.off(),
                    0,
                    editorMode,
                    DungeonMapContentModel.DungeonMapRenderState.selectToolLabel(),
                    "No dungeon map geometry available.",
                    List.copyOf(cells),
                    List.copyOf(edges),
                    List.copyOf(labels),
                    List.copyOf(markers),
                    List.copyOf(graphNodes),
                    List.copyOf(graphLinks),
                    null);
        }
    }
}
