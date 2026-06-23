package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorPreviewDiff;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.CellKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.EdgeKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.MarkerKind;

final class DungeonMapSnapshotProjectionContentPartModel {
    private static final String FEATURE_LABEL_KIND = "FEATURE_LABEL";
    private static final Map<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();

    DungeonMapContentModel.DungeonMapRenderState mapEditorSurface(
            String placeholderTitle,
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel
    ) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : snapshot;
        DungeonMapContentModel.DungeonMapRenderState baseState = mapEditorRenderState(
                placeholderTitle,
                safeSnapshot.surface(),
                safeSnapshot.selection(),
                safeSnapshot.preview(),
                roomLabelPlacementContentPartModel,
                previewDiffContentPartModel,
                true);
        return baseState.withViewMode(
                        DungeonMapContentModel.DungeonMapRenderState.ViewMode.fromEditor(safeSnapshot.viewMode()))
                .withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(toolLabel(safeSnapshot.selectedTool()));
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
        return TOOL_LABELS.getOrDefault(
                selectedTool,
                DungeonMapContentModel.DungeonMapRenderState.selectToolLabel());
    }

    private static Map<DungeonEditorTool, String> createToolLabels() {
        Map<DungeonEditorTool, String> labels = new EnumMap<>(DungeonEditorTool.class);
        labels.put(
                DungeonEditorTool.SELECT,
                DungeonMapContentModel.DungeonMapRenderState.selectToolLabel());
        labels.put(DungeonEditorTool.ROOM_PAINT, "Raum malen");
        labels.put(DungeonEditorTool.ROOM_DELETE, "Raum löschen");
        labels.put(DungeonEditorTool.WALL_CREATE, "Wand setzen");
        labels.put(DungeonEditorTool.WALL_DELETE, "Wand löschen");
        labels.put(DungeonEditorTool.DOOR_CREATE, "Tür setzen");
        labels.put(DungeonEditorTool.DOOR_DELETE, "Tür löschen");
        labels.put(DungeonEditorTool.CORRIDOR_CREATE, "Korridor erstellen");
        labels.put(DungeonEditorTool.CORRIDOR_DELETE, "Korridor löschen");
        labels.put(DungeonEditorTool.STAIR_CREATE, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_CREATE_SQUARE, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_CREATE_CIRCULAR, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_DELETE, "Treppe löschen");
        labels.put(DungeonEditorTool.TRANSITION_CREATE, "Übergang erstellen");
        labels.put(DungeonEditorTool.TRANSITION_DELETE, "Übergang löschen");
        labels.put(DungeonEditorTool.FEATURE_POI_CREATE, "POI erstellen");
        labels.put(DungeonEditorTool.FEATURE_OBJECT_CREATE, "Objekt erstellen");
        labels.put(DungeonEditorTool.FEATURE_ENCOUNTER_CREATE, "Encounter erstellen");
        labels.put(DungeonEditorTool.FEATURE_DELETE, "Feature löschen");
        return labels;
    }

    static DungeonMapContentModel.DungeonMapRenderState.CellKind featureCellKind(String kind) {
        return featureCellKind(featureKind(kind));
    }

    static DungeonMapContentModel.DungeonMapRenderState.MarkerKind featureMarkerKind(String kind) {
        return featureMarkerKind(featureKind(kind));
    }

    static String featureMarkerLabel(String kind) {
        return featureMarkerLabel(featureKind(kind));
    }

    private static DungeonMapContentModel.DungeonMapRenderState.CellKind featureCellKind(DungeonFeatureKind kind) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> CellKind.TRANSITION;
            case STAIR -> CellKind.STAIR;
            case OBJECT -> CellKind.FEATURE_OBJECT;
            case ENCOUNTER -> CellKind.FEATURE_ENCOUNTER;
            case POI -> CellKind.FEATURE_POI;
        };
    }

    private static DungeonMapContentModel.DungeonMapRenderState.MarkerKind featureMarkerKind(DungeonFeatureKind kind) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> MarkerKind.WAYPOINT;
            case STAIR -> MarkerKind.STAIR;
            case OBJECT -> MarkerKind.FEATURE_OBJECT;
            case ENCOUNTER -> MarkerKind.FEATURE_ENCOUNTER;
            case POI -> MarkerKind.FEATURE_POI;
        };
    }

    private static String featureMarkerLabel(DungeonFeatureKind kind) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> "->";
            case STAIR -> "z";
            case OBJECT -> "O";
            case ENCOUNTER -> "E";
            case POI -> "P";
        };
    }

    private static DungeonFeatureKind featureKind(String kind) {
        if (kind == null || kind.isBlank()) {
            return DungeonFeatureKind.STAIR;
        }
        try {
            return DungeonFeatureKind.valueOf(kind.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return DungeonFeatureKind.STAIR;
        }
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
                        featureCellKind(feature.kind()),
                        feature.id(),
                        0L,
                        DungeonMapContentModel.EditorProjectionFacts.topologyRef(feature.topologyRef()),
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
                    DungeonMapContentModel.EditorProjectionFacts.topologyRef(area.topologyRef()),
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
                    DungeonMapContentModel.EditorProjectionFacts.topologyRef(boundary.topologyRef()),
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
            labels.add(DungeonMapContentModel.RoomLabelRenderElements.roomLabel(
                    area.label(),
                    area.id(),
                    area.clusterId(),
                    DungeonMapContentModel.EditorProjectionFacts.topologyRef(area.topologyRef()),
                    areaCells,
                    roomLabelPlacementContentPartModel,
                    false,
                    false));
        }
        for (DungeonFeatureSnapshot feature : features) {
            CellCenter center = centerOf(feature.cells());
            labels.add(new DungeonMapContentModel.DungeonMapRenderState.Label(
                    feature.label(),
                    center.q(),
                    center.r(),
                    center.level(),
                    feature.id(),
                    0L,
                    DungeonMapContentModel.EditorProjectionFacts.topologyRef(feature.topologyRef()),
                    FEATURE_LABEL_KIND,
                    false,
                    false,
                    0.0,
                    0.0));
        }
        return List.copyOf(labels);
    }

    private static List<DungeonMapContentModel.DungeonMapRenderState.Marker> travelMarkers(
            List<DungeonFeatureSnapshot> features
    ) {
        List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers = new ArrayList<>();
        for (DungeonFeatureSnapshot feature : features) {
            CellCenter center = centerOf(feature.cells());
            markers.add(new DungeonMapContentModel.DungeonMapRenderState.Marker(
                    featureMarkerLabel(feature.kind()),
                    center.q(),
                    center.r(),
                    center.level(),
                    featureMarkerKind(feature.kind()),
                    false,
                    DungeonMapContentModel.EditorRenderElements.markerHandle(
                            (int) Math.floor(center.q()),
                            (int) Math.floor(center.r()),
                            center.level()),
                    false));
        }
        return List.copyOf(markers);
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
            DungeonEditorPreview preview,
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
                surface.previewDiff(),
                selection == null ? DungeonEditorStateSnapshot.Selection.empty() : selection,
                preview == null ? DungeonEditorPreview.none() : preview,
                roomLabelPlacementContentPartModel,
                previewDiffContentPartModel == null
                        ? new DungeonMapPreviewDiffContentPartModel()
                        : previewDiffContentPartModel);
        return projection.renderState(surface, map, editorMode);
    }

    private static ProjectionAccumulator assemble(
            DungeonEditorMapSnapshot map,
            DungeonEditorPreviewDiff previewDiff,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel
    ) {
        ProjectionAccumulator projection = new ProjectionAccumulator();
        projection.addAreas(map, selection, roomLabelPlacementContentPartModel);
        projection.addClusterLabels(map, selection);
        projection.addPreviewAndBoundaries(map, selection, preview);
        projection.addFeatures(map, selection);
        projection.addHandles(map, selection, preview);
        projection.addPreviewDiff(
                previewDiffContentPartModel,
                previewDiff,
                selection,
                preview,
                roomLabelPlacementContentPartModel);
        projection.addFallbackGraphLinks();
        return projection;
    }

    private record CellCenter(double q, double r, int level) {
    }

    private interface EditorPreviewProjection {

        static void addEditorPreview(
                List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
                List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges,
                List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
                List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
                DungeonEditorPreview preview
        ) {
            if (preview instanceof DungeonEditorPreview.ClusterBoundariesPreview boundaryEdges) {
                addBoundaryEdgesPreview(edges, boundaryEdges);
                return;
            }
            if (preview instanceof DungeonEditorPreview.StairCreatePreview stairCreatePreview) {
                addStairCreatePreview(cells, labels, markers, stairCreatePreview);
            }
        }

        static void addBoundaryEdgesPreview(
                List<DungeonMapContentModel.DungeonMapRenderState.Edge> edges,
                DungeonEditorPreview.ClusterBoundariesPreview boundaryEdges
        ) {
            DungeonMapContentModel.DungeonMapRenderState.EdgeKind kind =
                    boundaryKind(boundaryEdges.boundaryKind());
            for (DungeonEdgeRef edge : boundaryEdges.edges()) {
                if (DungeonMapContentModel.EditorProjectionFacts.invalidEdge(edge)) {
                    continue;
                }
                edges.add(new DungeonMapContentModel.DungeonMapRenderState.Edge(
                        edge.from().q(),
                        edge.from().r(),
                        edge.to().q(),
                        edge.to().r(),
                        edge.from().level(),
                        kind,
                        boundaryEdges.deleteMode() ? "Delete preview" : "Boundary preview",
                        boundaryEdges.clusterId(),
                        DungeonMapContentModel.DungeonMapRenderState.TopologyRef.empty(),
                        false,
                        true));
            }
        }

        static void addStairCreatePreview(
                List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
                List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
                List<DungeonMapContentModel.DungeonMapRenderState.Marker> markers,
                DungeonEditorPreview.StairCreatePreview preview
        ) {
            if (preview.valid()) {
                return;
            }
            DungeonCellRef anchor = preview.anchor();
            DungeonCellRef end = preview.end();
            String label = stairPreviewLabel(preview.shapeName());
            addStairDraftCell(cells, labels, anchor, label);
            if (!anchor.equals(end)) {
                addStairDraftCell(cells, labels, end, "Treppen-Ziel");
            }
            markers.add(new DungeonMapContentModel.DungeonMapRenderState.Marker(
                    "z",
                    anchor.q() + 0.5,
                    anchor.r() + 0.5,
                    anchor.level(),
                    MarkerKind.STAIR,
                    false,
                    DungeonMapContentModel.EditorRenderElements.markerHandle(
                            anchor.q(),
                            anchor.r(),
                            anchor.level()),
                    true));
        }

        static void addStairDraftCell(
                List<DungeonMapContentModel.DungeonMapRenderState.Cell> cells,
                List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
                DungeonCellRef cell,
                String label
        ) {
            cells.add(new DungeonMapContentModel.DungeonMapRenderState.Cell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    label,
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
                    cell,
                    0L,
                    DungeonMapContentModel.DungeonMapRenderState.TopologyRef.empty());
        }

        static String stairPreviewLabel(String shapeName) {
            return switch (shapeName == null ? "" : shapeName.trim().toUpperCase(Locale.ROOT)) {
                case "SQUARE" -> "Treppen-Vorschau: Eckspirale";
                case "CIRCULAR" -> "Treppen-Vorschau: Rundspirale";
                default -> "Treppen-Vorschau: Gerade";
            };
        }
    }

    private static DungeonMapContentModel.DungeonMapRenderState.EdgeKind boundaryKind(String kind) {
        return "DOOR".equalsIgnoreCase(kind)
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
                        DungeonMapContentModel.EditorSelectionFacts.selectedAreaSurface(area, selection),
                        DungeonMapContentModel.EditorSelectionFacts.selectedArea(area, selection),
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
                areaCells.add(DungeonMapContentModel.EditorRenderElements.cell(
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
            DungeonMapContentModel.EditorProjectionFacts.CellCenter center =
                    DungeonMapContentModel.EditorProjectionFacts.centerOfCells(areaCells);
            graphNodes.add(new DungeonMapContentModel.DungeonMapRenderState.GraphNode(
                    area.id(),
                    DungeonMapContentModel.EditorProjectionFacts.clusterId(area),
                    area.label(),
                    center.q(),
                    center.r(),
                    annotationSelected));
            if (areaCells.getFirst().kind() == CellKind.ROOM) {
                labels.add(DungeonMapContentModel.EditorRenderElements.roomLabel(
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
                labels.add(DungeonMapContentModel.EditorRenderElements.clusterLabel(
                        handle,
                        DungeonMapContentModel.EditorSelectionFacts.selectedClusterLabel(handle, selection),
                        false,
                        0,
                        0,
                        0));
            }
        }

        private void addPreviewAndBoundaries(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview
        ) {
            EditorPreviewProjection.addEditorPreview(cells, edges, labels, markers, preview);
            for (DungeonEditorMapSnapshot.Boundary boundary : map.boundaries()) {
                if (DungeonMapContentModel.EditorProjectionFacts.invalidEdge(boundary.edge())) {
                    continue;
                }
                edges.add(DungeonMapContentModel.EditorRenderElements.edge(
                        boundary,
                        0,
                        0,
                        0,
                        false,
                        DungeonMapContentModel.EditorSelectionFacts.selectedBoundary(boundary, selection)));
            }
        }

        private void addFeatures(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection
        ) {
            for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
                addFeature(feature, DungeonMapContentModel.EditorSelectionFacts.selectedFeature(feature, selection));
            }
        }

        private void addFeature(
                DungeonEditorMapSnapshot.Feature feature,
                boolean selected
        ) {
            List<DungeonMapContentModel.DungeonMapRenderState.Cell> featureCells = new ArrayList<>();
            for (DungeonCellRef cell : feature.cells()) {
                featureCells.add(DungeonMapContentModel.EditorRenderElements.featureCell(feature, cell, selected));
            }
            cells.addAll(featureCells);
            if (featureCells.isEmpty()) {
                return;
            }
            DungeonMapContentModel.EditorProjectionFacts.CellCenter center =
                    DungeonMapContentModel.EditorProjectionFacts.centerOfCells(featureCells);
            labels.add(new DungeonMapContentModel.DungeonMapRenderState.Label(
                    feature.label(),
                    center.q(),
                    center.r(),
                    featureCells.getFirst().z(),
                    feature.id(),
                    0L,
                    DungeonMapContentModel.EditorProjectionFacts.featureTopologyRef(feature),
                    FEATURE_LABEL_KIND,
                    selected,
                    false,
                    0.0,
                    0.0));
            markers.add(DungeonMapContentModel.EditorRenderElements.featureMarker(
                    feature,
                    center,
                    featureCells.getFirst().z(),
                    selected));
        }

        private void addHandles(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview
        ) {
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                if (!DungeonMapContentModel.EditorHandleVisibility.visibleCanvasHandle(handle.ref(), selection)) {
                    continue;
                }
                if (movingPreviewHandle(handle.ref(), preview)) {
                    continue;
                }
                markers.add(DungeonMapContentModel.EditorRenderElements.handleMarker(handle, selection, false));
            }
        }

        private static boolean movingPreviewHandle(DungeonEditorHandleRef ref, DungeonEditorPreview preview) {
            return preview instanceof DungeonEditorPreview.MoveHandlePreview handlePreview
                    && DungeonMapContentModel.EditorProjectionFacts.sameHandleRef(ref, handlePreview.handleRef());
        }

        private void addPreviewDiff(
                DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel,
                DungeonEditorPreviewDiff previewDiff,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview,
                DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
        ) {
            if (!structuredPreviewDiffOwner(preview)) {
                return;
            }
            previewDiffContentPartModel.addPreviewDiff(
                    cells,
                    edges,
                    labels,
                    markers,
                    previewDiff,
                    selection,
                    roomLabelPlacementContentPartModel);
        }

        private static boolean structuredPreviewDiffOwner(DungeonEditorPreview preview) {
            return !(preview instanceof DungeonEditorPreview.ClusterBoundariesPreview);
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
