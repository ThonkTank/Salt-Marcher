package features.dungeon.adapter.javafx.map;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonAreaKind;
import features.dungeon.api.DungeonAreaSnapshot;
import features.dungeon.api.DungeonBoundarySnapshot;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonFeatureSnapshot;
import features.dungeon.api.DungeonMapSnapshot;
import features.dungeon.api.DungeonTravelSurfaceSnapshot;
import features.dungeon.adapter.javafx.map.DungeonMapRenderState.CellKind;
import features.dungeon.adapter.javafx.map.DungeonMapRenderState.EdgeKind;

final class DungeonMapTravelRenderProjector {
    private final DungeonMapRoomLabelPlanner roomLabelPlanner;
    private final DungeonMapTravelMarkerProjector markerProjector = new DungeonMapTravelMarkerProjector();

    DungeonMapTravelRenderProjector(DungeonMapRoomLabelPlanner roomLabelPlanner) {
        this.roomLabelPlanner = roomLabelPlanner;
    }

    DungeonMapRenderState project(String placeholderTitle, @Nullable DungeonTravelSurfaceSnapshot surface) {
        if (surface == null) {
            return DungeonMapRenderState.empty(placeholderTitle, false);
        }
        DungeonMapSnapshot map = surface.map();
        List<DungeonMapRenderState.Cell> cells = travelCells(map);
        List<DungeonMapRenderState.Edge> edges = travelEdges(map.boundaries());
        List<DungeonMapRenderState.Label> labels = travelLabels(map.areas());
        List<DungeonMapRenderState.Marker> markers = markerProjector.travelMarkers(map.features());
        DungeonMapRenderState.PartyToken partyToken = travelPartyToken(surface);
        DungeonMapPresentationExtent extent = DungeonMapPresentationExtent.from(
                cells, edges, labels, markers, partyToken);
        List<DungeonMapRenderState.GraphNode> graphNodes = travelGraphNodes(map.areas());
        return new DungeonMapRenderState(
                surface.mapName(),
                true,
                extent.width(),
                extent.height(),
                DungeonMapRenderState.Topology.fromPublished(map.topology()),
                DungeonMapRenderState.ViewMode.grid(),
                DungeonMapRenderState.LevelOverlaySettings.off(),
                0,
                false,
                DungeonMapRenderState.selectToolLabel(),
                "No dungeon map geometry available.",
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                travelFallbackGraphLinks(graphNodes),
                partyToken);
    }

    private List<DungeonMapRenderState.Cell> travelCells(DungeonMapSnapshot map) {
        List<DungeonMapRenderState.Cell> cells = new ArrayList<>();
        for (DungeonAreaSnapshot area : map.areas()) {
            appendTravelAreaCells(cells, area);
        }
        for (DungeonFeatureSnapshot feature : map.features()) {
            for (DungeonCellRef cell : feature.cells()) {
                cells.add(new DungeonMapRenderState.Cell(
                        cell.q(),
                        cell.r(),
                        cell.level(),
                        feature.label(),
                        DungeonMapRenderCells.featureCellKind(feature.kind()),
                        feature.id(),
                        0L,
                        DungeonMapRenderElementFactory.topologyRef(feature.topologyRef()),
                        false,
                        false,
                        false,
                        false));
            }
        }
        return List.copyOf(cells);
    }

    private List<DungeonMapRenderState.Edge> travelEdges(
            List<DungeonBoundarySnapshot> boundaries
    ) {
        List<DungeonMapRenderState.Edge> edges = new ArrayList<>();
        for (DungeonBoundarySnapshot boundary : boundaries) {
            edges.add(new DungeonMapRenderState.Edge(
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
                    DungeonMapRenderElementFactory.topologyRef(boundary.topologyRef()),
                    false,
                    false));
        }
        return List.copyOf(edges);
    }

    private List<DungeonMapRenderState.Label> travelLabels(List<DungeonAreaSnapshot> areas) {
        List<DungeonMapRenderState.Label> labels = new ArrayList<>();
        for (DungeonAreaSnapshot area : areas) {
            if (area.kind() == DungeonAreaKind.CORRIDOR) {
                continue;
            }
            List<DungeonMapRenderState.Cell> areaCells = travelAreaCells(area);
            if (areaCells.isEmpty()) {
                continue;
            }
            labels.add(DungeonMapRenderElementFactory.roomLabel(
                    area.label(),
                    area.id(),
                    area.clusterId(),
                    DungeonMapRenderElementFactory.topologyRef(area.topologyRef()),
                    areaCells,
                    roomLabelPlanner,
                    false,
                    false));
        }
        return List.copyOf(labels);
    }

    private List<DungeonMapRenderState.GraphNode> travelGraphNodes(
            List<DungeonAreaSnapshot> areas
    ) {
        List<DungeonMapRenderState.GraphNode> nodes = new ArrayList<>();
        for (DungeonAreaSnapshot area : areas) {
            if (area.cells().isEmpty()) {
                continue;
            }
            DungeonMapTravelMarkerProjector.TravelCellCenter center =
                    DungeonMapTravelMarkerProjector.TravelCellCenter.of(area.cells());
            nodes.add(new DungeonMapRenderState.GraphNode(
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    center.q(),
                    center.r(),
                    false));
        }
        return List.copyOf(nodes);
    }

    private List<DungeonMapRenderState.GraphLink> travelFallbackGraphLinks(
            List<DungeonMapRenderState.GraphNode> nodes
    ) {
        int maximumLinklessGraphNodeCount = 1;
        if (nodes.size() <= maximumLinklessGraphNodeCount) {
            return List.of();
        }
        List<DungeonMapRenderState.GraphLink> links = new ArrayList<>();
        for (int index = 1; index < nodes.size(); index++) {
            links.add(new DungeonMapRenderState.GraphLink(
                    nodes.get(index - 1).id(),
                    nodes.get(index).id(),
                    false));
        }
        return List.copyOf(links);
    }

    private DungeonMapRenderState.PartyToken travelPartyToken(
            DungeonTravelSurfaceSnapshot surface
    ) {
        if (surface.position() == null) {
            return null;
        }
        DungeonCellRef tile = surface.position().tile();
        return new DungeonMapRenderState.PartyToken(
                tile.q() + 0.5,
                tile.r() + 0.5,
                tile.level(),
                DungeonMapRenderState.Heading.fromEditor(surface.position().heading()),
                true);
    }

    private static List<DungeonMapRenderState.Cell> travelAreaCells(
            DungeonAreaSnapshot area
    ) {
        List<DungeonMapRenderState.Cell> cells = new ArrayList<>();
        appendTravelAreaCells(cells, area);
        return List.copyOf(cells);
    }

    private static void appendTravelAreaCells(
            List<DungeonMapRenderState.Cell> cells,
            DungeonAreaSnapshot area
    ) {
        for (DungeonCellRef cell : area.cells()) {
            cells.add(new DungeonMapRenderState.Cell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    area.label(),
                    area.kind() == DungeonAreaKind.CORRIDOR
                            ? CellKind.CORRIDOR
                            : CellKind.ROOM,
                    area.id(),
                    area.clusterId(),
                    DungeonMapRenderElementFactory.topologyRef(area.topologyRef()),
                    false,
                    false,
                    false,
                    false));
        }
    }
}
