package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;

final class DungeonMapEditorRenderStateMapper {

    private static final EnumMap<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();

    private DungeonMapEditorRenderStateMapper() {
    }

    static DungeonMapRenderState map(String placeholderTitle, DungeonEditorSnapshot snapshot) {
        DungeonEditorSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorSnapshot.empty("")
                : snapshot;
        DungeonMapRenderState baseState = mapProjection(placeholderTitle, safeSnapshot.mapProjection());
        return baseState.withViewMode(toViewMode(safeSnapshot.viewMode()))
                .withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(toolLabel(safeSnapshot.selectedTool()));
    }

    private static DungeonMapRenderState mapProjection(
            String placeholderTitle,
            DungeonEditorMapProjectionSnapshot projection
    ) {
        if (projection == null) {
            return DungeonMapRenderState.empty(placeholderTitle, true);
        }
        return new DungeonMapRenderState(
                projection.mapName(),
                true,
                Math.max(1, projection.width()),
                Math.max(1, projection.height()),
                toTopology(projection.topology()),
                DungeonMapRenderState.ViewMode.GRID,
                DungeonMapRenderState.LevelOverlaySettings.off(),
                0,
                true,
                DungeonMapRenderState.SELECT_TOOL_LABEL,
                "No dungeon map geometry available.",
                mapCells(projection.cells()),
                mapEdges(projection.edges()),
                mapLabels(projection.labels()),
                mapMarkers(projection.markers()),
                mapGraphNodes(projection.graphNodes()),
                mapGraphLinks(projection.graphLinks()),
                null);
    }

    private static List<DungeonMapRenderState.Cell> mapCells(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells
    ) {
        List<DungeonMapRenderState.Cell> mapped = new ArrayList<>(cells.size());
        for (DungeonEditorMapProjectionSnapshot.CellProjection cell : cells) {
            mapped.add(new DungeonMapRenderState.Cell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    cell.label(),
                    DungeonMapRenderState.CellKind.fromKey(cell.kind().name()),
                    cell.ownerId(),
                    cell.clusterId(),
                    new DungeonMapRenderState.TopologyRef(cell.topologyRef().kind(), cell.topologyRef().id()),
                    cell.selected(),
                    cell.overlay(),
                    cell.preview(),
                    cell.destructivePreview()));
        }
        return List.copyOf(mapped);
    }

    private static List<DungeonMapRenderState.Edge> mapEdges(
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges
    ) {
        List<DungeonMapRenderState.Edge> mapped = new ArrayList<>(edges.size());
        for (DungeonEditorMapProjectionSnapshot.EdgeProjection edge : edges) {
            mapped.add(new DungeonMapRenderState.Edge(
                    edge.startQ(),
                    edge.startR(),
                    edge.endQ(),
                    edge.endR(),
                    edge.level(),
                    DungeonMapRenderState.EdgeKind.fromKey(edge.kind().name()),
                    edge.label(),
                    edge.ownerId(),
                    new DungeonMapRenderState.TopologyRef(edge.topologyRef().kind(), edge.topologyRef().id()),
                    edge.selected(),
                    edge.preview()));
        }
        return List.copyOf(mapped);
    }

    private static List<DungeonMapRenderState.Label> mapLabels(
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels
    ) {
        List<DungeonMapRenderState.Label> mapped = new ArrayList<>(labels.size());
        for (DungeonEditorMapProjectionSnapshot.LabelProjection label : labels) {
            mapped.add(new DungeonMapRenderState.Label(
                    label.label(),
                    label.q(),
                    label.r(),
                    label.level(),
                    label.ownerId(),
                    label.clusterId(),
                    new DungeonMapRenderState.TopologyRef(label.topologyRef().kind(), label.topologyRef().id()),
                    label.selected(),
                    label.preview()));
        }
        return List.copyOf(mapped);
    }

    private static List<DungeonMapRenderState.Marker> mapMarkers(
            List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers
    ) {
        List<DungeonMapRenderState.Marker> mapped = new ArrayList<>(markers.size());
        for (DungeonEditorMapProjectionSnapshot.MarkerProjection marker : markers) {
            mapped.add(new DungeonMapRenderState.Marker(
                    marker.label(),
                    marker.q(),
                    marker.r(),
                    marker.level(),
                    DungeonMapRenderState.MarkerKind.fromKey(marker.kind().name()),
                    marker.selected(),
                    new DungeonMapRenderState.MarkerHandle(
                            marker.handleRef().kind(),
                            new DungeonMapRenderState.TopologyRef(
                                    marker.handleRef().topologyRef().kind(),
                                    marker.handleRef().topologyRef().id()),
                            marker.handleRef().ownerId(),
                            marker.handleRef().clusterId(),
                            marker.handleRef().corridorId(),
                            marker.handleRef().roomId(),
                            marker.handleRef().index(),
                            marker.handleRef().cell().q(),
                            marker.handleRef().cell().r(),
                            marker.handleRef().cell().level(),
                            marker.handleRef().direction()),
                    marker.preview()));
        }
        return List.copyOf(mapped);
    }

    private static List<DungeonMapRenderState.GraphNode> mapGraphNodes(
            List<DungeonEditorMapProjectionSnapshot.GraphNodeProjection> nodes
    ) {
        List<DungeonMapRenderState.GraphNode> mapped = new ArrayList<>(nodes.size());
        for (DungeonEditorMapProjectionSnapshot.GraphNodeProjection node : nodes) {
            mapped.add(new DungeonMapRenderState.GraphNode(
                    node.id(),
                    node.clusterId(),
                    node.label(),
                    node.q(),
                    node.r(),
                    node.selected()));
        }
        return List.copyOf(mapped);
    }

    private static List<DungeonMapRenderState.GraphLink> mapGraphLinks(
            List<DungeonEditorMapProjectionSnapshot.GraphLinkProjection> links
    ) {
        List<DungeonMapRenderState.GraphLink> mapped = new ArrayList<>(links.size());
        for (DungeonEditorMapProjectionSnapshot.GraphLinkProjection link : links) {
            mapped.add(new DungeonMapRenderState.GraphLink(link.fromId(), link.toId(), link.selected()));
        }
        return List.copyOf(mapped);
    }

    private static DungeonMapRenderState.ViewMode toViewMode(DungeonEditorViewMode viewMode) {
        return viewMode == DungeonEditorViewMode.GRAPH
                ? DungeonMapRenderState.ViewMode.GRAPH
                : DungeonMapRenderState.ViewMode.GRID;
    }

    private static DungeonMapRenderState.LevelOverlaySettings toOverlaySettings(
            DungeonEditorOverlaySettings overlaySettings
    ) {
        DungeonEditorOverlaySettings safeOverlay = overlaySettings == null
                ? DungeonEditorOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonMapRenderState.LevelOverlaySettings(
                DungeonMapRenderState.OverlayMode.fromKey(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static DungeonMapRenderState.Topology toTopology(
            DungeonEditorMapProjectionSnapshot.TopologyKind topology
    ) {
        return topology == DungeonEditorMapProjectionSnapshot.TopologyKind.HEX
                ? DungeonMapRenderState.Topology.HEX
                : DungeonMapRenderState.Topology.SQUARE;
    }

    private static String toolLabel(DungeonEditorTool selectedTool) {
        return TOOL_LABELS.getOrDefault(selectedTool, DungeonMapRenderState.SELECT_TOOL_LABEL);
    }

    private static EnumMap<DungeonEditorTool, String> createToolLabels() {
        EnumMap<DungeonEditorTool, String> labels = new EnumMap<>(DungeonEditorTool.class);
        labels.put(DungeonEditorTool.SELECT, DungeonMapRenderState.SELECT_TOOL_LABEL);
        labels.put(DungeonEditorTool.ROOM_PAINT, "Raum malen");
        labels.put(DungeonEditorTool.ROOM_DELETE, "Raum löschen");
        labels.put(DungeonEditorTool.WALL_CREATE, "Wand setzen");
        labels.put(DungeonEditorTool.WALL_DELETE, "Wand löschen");
        labels.put(DungeonEditorTool.DOOR_CREATE, "Tür setzen");
        labels.put(DungeonEditorTool.DOOR_DELETE, "Tür löschen");
        labels.put(DungeonEditorTool.CORRIDOR_CREATE, "Korridor erstellen");
        labels.put(DungeonEditorTool.CORRIDOR_DELETE, "Korridor löschen");
        labels.put(DungeonEditorTool.STAIR_CREATE, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_DELETE, "Treppe löschen");
        labels.put(DungeonEditorTool.TRANSITION_CREATE, "Übergang erstellen");
        labels.put(DungeonEditorTool.TRANSITION_DELETE, "Übergang löschen");
        return labels;
    }
}
