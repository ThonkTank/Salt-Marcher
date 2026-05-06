package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import src.domain.travel.published.TravelDungeonMapProjectionSnapshot;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelOverlaySettings;

final class DungeonMapTravelRenderStateMapper {

    private DungeonMapTravelRenderStateMapper() {
    }

    static DungeonMapRenderState map(String placeholderTitle, TravelDungeonSnapshot snapshot) {
        TravelDungeonSnapshot safeSnapshot = snapshot == null
                ? TravelDungeonSnapshot.empty()
                : snapshot;
        DungeonMapRenderState baseState = mapProjection(placeholderTitle, safeSnapshot.mapProjection());
        return baseState.withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(DungeonMapRenderState.SELECT_TOOL_LABEL);
    }

    private static DungeonMapRenderState mapProjection(
            String placeholderTitle,
            TravelDungeonMapProjectionSnapshot projection
    ) {
        if (projection == null) {
            return DungeonMapRenderState.empty(placeholderTitle, false);
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
                false,
                DungeonMapRenderState.SELECT_TOOL_LABEL,
                "No dungeon map geometry available.",
                mapCells(projection.cells()),
                mapEdges(projection.edges()),
                mapLabels(projection.labels()),
                mapMarkers(projection.markers()),
                mapGraphNodes(projection.graphNodes()),
                mapGraphLinks(projection.graphLinks()),
                mapPartyToken(projection.partyToken()));
    }

    private static List<DungeonMapRenderState.Cell> mapCells(
            List<TravelDungeonMapProjectionSnapshot.CellProjection> cells
    ) {
        List<DungeonMapRenderState.Cell> mapped = new ArrayList<>(cells.size());
        for (TravelDungeonMapProjectionSnapshot.CellProjection cell : cells) {
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
            List<TravelDungeonMapProjectionSnapshot.EdgeProjection> edges
    ) {
        List<DungeonMapRenderState.Edge> mapped = new ArrayList<>(edges.size());
        for (TravelDungeonMapProjectionSnapshot.EdgeProjection edge : edges) {
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
            List<TravelDungeonMapProjectionSnapshot.LabelProjection> labels
    ) {
        List<DungeonMapRenderState.Label> mapped = new ArrayList<>(labels.size());
        for (TravelDungeonMapProjectionSnapshot.LabelProjection label : labels) {
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
            List<TravelDungeonMapProjectionSnapshot.MarkerProjection> markers
    ) {
        List<DungeonMapRenderState.Marker> mapped = new ArrayList<>(markers.size());
        for (TravelDungeonMapProjectionSnapshot.MarkerProjection marker : markers) {
            mapped.add(new DungeonMapRenderState.Marker(
                    marker.label(),
                    marker.q(),
                    marker.r(),
                    marker.level(),
                    DungeonMapRenderState.MarkerKind.fromKey(marker.kind().name()),
                    marker.selected(),
                    new DungeonMapRenderState.MarkerHandle(
                            marker.handle().kind(),
                            new DungeonMapRenderState.TopologyRef(
                                    marker.handle().topologyRef().kind(),
                                    marker.handle().topologyRef().id()),
                            marker.handle().ownerId(),
                            marker.handle().clusterId(),
                            marker.handle().corridorId(),
                            marker.handle().roomId(),
                            marker.handle().index(),
                            marker.handle().q(),
                            marker.handle().r(),
                            marker.handle().level(),
                            marker.handle().direction()),
                    marker.preview()));
        }
        return List.copyOf(mapped);
    }

    private static List<DungeonMapRenderState.GraphNode> mapGraphNodes(
            List<TravelDungeonMapProjectionSnapshot.GraphNodeProjection> nodes
    ) {
        List<DungeonMapRenderState.GraphNode> mapped = new ArrayList<>(nodes.size());
        for (TravelDungeonMapProjectionSnapshot.GraphNodeProjection node : nodes) {
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
            List<TravelDungeonMapProjectionSnapshot.GraphLinkProjection> links
    ) {
        List<DungeonMapRenderState.GraphLink> mapped = new ArrayList<>(links.size());
        for (TravelDungeonMapProjectionSnapshot.GraphLinkProjection link : links) {
            mapped.add(new DungeonMapRenderState.GraphLink(link.fromId(), link.toId(), link.selected()));
        }
        return List.copyOf(mapped);
    }

    private static DungeonMapRenderState.PartyToken mapPartyToken(
            TravelDungeonMapProjectionSnapshot.PartyTokenProjection token
    ) {
        if (token == null) {
            return null;
        }
        return new DungeonMapRenderState.PartyToken(
                token.q(),
                token.r(),
                token.level(),
                DungeonMapRenderState.Heading.fromName(token.heading().name()),
                token.visible());
    }

    private static DungeonMapRenderState.LevelOverlaySettings toOverlaySettings(
            TravelOverlaySettings overlaySettings
    ) {
        TravelOverlaySettings safeOverlay = overlaySettings == null
                ? TravelOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonMapRenderState.LevelOverlaySettings(
                DungeonMapRenderState.OverlayMode.fromKey(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static DungeonMapRenderState.Topology toTopology(
            TravelDungeonMapProjectionSnapshot.TopologyKind topology
    ) {
        return topology == TravelDungeonMapProjectionSnapshot.TopologyKind.HEX
                ? DungeonMapRenderState.Topology.HEX
                : DungeonMapRenderState.Topology.SQUARE;
    }
}
