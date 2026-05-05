package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;
import src.domain.travel.published.TravelDungeonMapProjectionSnapshot;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelOverlaySettings;

public final class DungeonMapContentModel {

    private final String placeholderTitle;
    private final boolean editorMode;
    private final ReadOnlyObjectWrapper<RenderState> renderState;
    private @Nullable ProjectionData projection;
    private RenderState.ViewMode viewMode = RenderState.ViewMode.GRID;
    private RenderState.LevelOverlaySettings overlaySettings = RenderState.LevelOverlaySettings.defaults();
    private int projectionLevel;
    private String selectedTool = "Auswahl";

    public DungeonMapContentModel(String placeholderTitle, boolean editorMode) {
        this.placeholderTitle = placeholderTitle == null || placeholderTitle.isBlank()
                ? "Dungeon Map"
                : placeholderTitle;
        this.editorMode = editorMode;
        renderState = new ReadOnlyObjectWrapper<>(RenderState.empty(this.placeholderTitle));
    }

    public ReadOnlyObjectProperty<RenderState> renderStateProperty() {
        return renderState.getReadOnlyProperty();
    }

    public void selectViewMode(RenderState.ViewMode nextViewMode) {
        viewMode = nextViewMode == null ? RenderState.ViewMode.GRID : nextViewMode;
        rebuildRenderState();
    }

    public void selectOverlayMode(RenderState.OverlayMode nextOverlayMode) {
        overlaySettings = new RenderState.LevelOverlaySettings(
                nextOverlayMode,
                overlaySettings.levelRange(),
                overlaySettings.opacity(),
                overlaySettings.selectedLevels());
        rebuildRenderState();
    }

    public void showOverlaySettings(RenderState.LevelOverlaySettings nextOverlaySettings) {
        overlaySettings = nextOverlaySettings == null
                ? RenderState.LevelOverlaySettings.off()
                : nextOverlaySettings;
        rebuildRenderState();
    }

    public void showProjectionLevel(int nextProjectionLevel) {
        projectionLevel = nextProjectionLevel;
        rebuildRenderState();
    }

    public void showSelectedTool(String nextSelectedTool) {
        selectedTool = normalizeTool(nextSelectedTool);
        rebuildRenderState();
    }

    public void applyEditorSnapshot(DungeonEditorSnapshot editorSnapshot) {
        DungeonEditorSnapshot safeSnapshot = editorSnapshot == null
                ? DungeonEditorSnapshot.empty("")
                : editorSnapshot;
        projection = toProjection(safeSnapshot.mapProjection());
        viewMode = toViewMode(safeSnapshot.viewMode());
        overlaySettings = toOverlaySettings(safeSnapshot.overlaySettings());
        projectionLevel = safeSnapshot.projectionLevel();
        selectedTool = toolLabel(safeSnapshot.selectedTool());
        rebuildRenderState();
    }

    public void applyTravelSnapshot(TravelDungeonSnapshot travelSnapshot) {
        TravelDungeonSnapshot safeSnapshot = travelSnapshot == null
                ? TravelDungeonSnapshot.empty()
                : travelSnapshot;
        projection = toProjection(safeSnapshot.mapProjection());
        viewMode = RenderState.ViewMode.GRID;
        overlaySettings = toOverlaySettings(safeSnapshot.overlaySettings());
        projectionLevel = safeSnapshot.projectionLevel();
        selectedTool = "Auswahl";
        rebuildRenderState();
    }

    private void rebuildRenderState() {
        renderState.set(RenderState.fromProjection(
                projection,
                placeholderTitle,
                editorMode,
                viewMode,
                overlaySettings,
                projectionLevel,
                selectedTool));
    }

    private static @Nullable ProjectionData toProjection(
            @Nullable DungeonEditorMapProjectionSnapshot projection
    ) {
        if (projection == null) {
            return null;
        }
        return projectionData(
                projection.mapName(),
                toProjectionTopology(projection.topology()),
                projection.width(),
                projection.height(),
                toEditorProjectionCells(projection.cells()),
                toEditorProjectionEdges(projection.edges()),
                toEditorProjectionLabels(projection.labels()),
                toEditorProjectionMarkers(projection.markers()),
                toEditorProjectionGraphNodes(projection.graphNodes()),
                toEditorProjectionGraphLinks(projection.graphLinks()),
                toProjectionPartyToken(projection.partyToken()));
    }

    private static @Nullable ProjectionData toProjection(
            @Nullable TravelDungeonMapProjectionSnapshot projection
    ) {
        if (projection == null) {
            return null;
        }
        return projectionData(
                projection.mapName(),
                toProjectionTopology(projection.topology()),
                projection.width(),
                projection.height(),
                toTravelProjectionCells(projection.cells()),
                toTravelProjectionEdges(projection.edges()),
                toTravelProjectionLabels(projection.labels()),
                toTravelProjectionMarkers(projection.markers()),
                toTravelProjectionGraphNodes(projection.graphNodes()),
                toTravelProjectionGraphLinks(projection.graphLinks()),
                toProjectionPartyToken(projection.partyToken()));
    }

    private static ProjectionData projectionData(
            String mapName,
            ProjectionData.ProjectionTopologyKind topology,
            int width,
            int height,
            List<ProjectionData.ProjectionCell> cells,
            List<ProjectionData.ProjectionEdge> edges,
            List<ProjectionData.ProjectionLabel> labels,
            List<ProjectionData.ProjectionMarker> markers,
            List<ProjectionData.ProjectionGraphNode> graphNodes,
            List<ProjectionData.ProjectionGraphLink> graphLinks,
            ProjectionData.@Nullable ProjectionPartyToken partyToken
    ) {
        return new ProjectionData(
                mapName,
                topology,
                width,
                height,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    private static ProjectionData.ProjectionTopologyKind toProjectionTopology(
            DungeonEditorMapProjectionSnapshot.TopologyKind topology
    ) {
        return topology == DungeonEditorMapProjectionSnapshot.TopologyKind.HEX
                ? ProjectionData.ProjectionTopologyKind.HEX
                : ProjectionData.ProjectionTopologyKind.SQUARE;
    }

    private static ProjectionData.ProjectionTopologyKind toProjectionTopology(
            TravelDungeonMapProjectionSnapshot.TopologyKind topology
    ) {
        return topology == TravelDungeonMapProjectionSnapshot.TopologyKind.HEX
                ? ProjectionData.ProjectionTopologyKind.HEX
                : ProjectionData.ProjectionTopologyKind.SQUARE;
    }

    private static ProjectionData.ProjectionCell toProjectionCell(
            DungeonEditorMapProjectionSnapshot.CellProjection cell
    ) {
        return projectionCell(
                cell.q(),
                cell.r(),
                cell.level(),
                cell.label(),
                cell.kind().name(),
                cell.ownerId(),
                cell.clusterId(),
                cell.topologyRef().kind(),
                cell.topologyRef().id(),
                cell.selected(),
                cell.overlay(),
                cell.preview(),
                cell.destructivePreview());
    }

    private static ProjectionData.ProjectionCell toProjectionCell(
            TravelDungeonMapProjectionSnapshot.CellProjection cell
    ) {
        TravelDungeonMapProjectionSnapshot.TopologyRef topologyRef = cell.topologyRef();
        String kind = cell.kind().name();
        int q = cell.q();
        int r = cell.r();
        int level = cell.level();
        return projectionCell(
                q,
                r,
                level,
                cell.label(),
                kind,
                cell.ownerId(),
                cell.clusterId(),
                topologyRef.kind(),
                topologyRef.id(),
                cell.selected(),
                cell.overlay(),
                cell.preview(),
                cell.destructivePreview());
    }

    private static ProjectionData.ProjectionCell projectionCell(
            int q,
            int r,
            int level,
            String label,
            String kind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            boolean selected,
            boolean overlay,
            boolean preview,
            boolean destructivePreview
    ) {
        return new ProjectionData.ProjectionCell(
                q,
                r,
                level,
                label,
                toProjectionCellKind(kind),
                ownerId,
                clusterId,
                new ProjectionData.ProjectionTopologyRef(topologyKind, topologyId),
                selected,
                overlay,
                preview,
                destructivePreview);
    }

    private static List<ProjectionData.ProjectionCell> toEditorProjectionCells(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells
    ) {
        List<ProjectionData.ProjectionCell> mapped = new ArrayList<>(cells.size());
        for (DungeonEditorMapProjectionSnapshot.CellProjection cell : cells) {
            mapped.add(toProjectionCell(cell));
        }
        return List.copyOf(mapped);
    }

    private static List<ProjectionData.ProjectionCell> toTravelProjectionCells(
            List<TravelDungeonMapProjectionSnapshot.CellProjection> cells
    ) {
        List<ProjectionData.ProjectionCell> mapped = new ArrayList<>(cells.size());
        for (TravelDungeonMapProjectionSnapshot.CellProjection cell : cells) {
            mapped.add(toProjectionCell(cell));
        }
        return List.copyOf(mapped);
    }

    private static ProjectionData.ProjectionEdge toProjectionEdge(
            DungeonEditorMapProjectionSnapshot.EdgeProjection edge
    ) {
        return projectionEdge(
                edge.startQ(),
                edge.startR(),
                edge.endQ(),
                edge.endR(),
                edge.level(),
                edge.kind().name(),
                edge.label(),
                edge.ownerId(),
                edge.topologyRef().kind(),
                edge.topologyRef().id(),
                edge.selected(),
                edge.preview());
    }

    private static ProjectionData.ProjectionEdge toProjectionEdge(
            TravelDungeonMapProjectionSnapshot.EdgeProjection edge
    ) {
        return projectionEdge(
                edge.startQ(),
                edge.startR(),
                edge.endQ(),
                edge.endR(),
                edge.level(),
                edge.kind().name(),
                edge.label(),
                edge.ownerId(),
                edge.topologyRef().kind(),
                edge.topologyRef().id(),
                edge.selected(),
                edge.preview());
    }

    private static ProjectionData.ProjectionEdge projectionEdge(
            double startQ,
            double startR,
            double endQ,
            double endR,
            int level,
            String kind,
            String label,
            long ownerId,
            String topologyKind,
            long topologyId,
            boolean selected,
            boolean preview
    ) {
        return new ProjectionData.ProjectionEdge(
                startQ,
                startR,
                endQ,
                endR,
                level,
                "DOOR".equalsIgnoreCase(kind)
                        ? ProjectionData.ProjectionEdgeKind.DOOR
                        : ProjectionData.ProjectionEdgeKind.WALL,
                label,
                ownerId,
                new ProjectionData.ProjectionTopologyRef(topologyKind, topologyId),
                selected,
                preview);
    }

    private static List<ProjectionData.ProjectionEdge> toEditorProjectionEdges(
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges
    ) {
        List<ProjectionData.ProjectionEdge> mapped = new ArrayList<>(edges.size());
        for (DungeonEditorMapProjectionSnapshot.EdgeProjection edge : edges) {
            mapped.add(toProjectionEdge(edge));
        }
        return List.copyOf(mapped);
    }

    private static List<ProjectionData.ProjectionEdge> toTravelProjectionEdges(
            List<TravelDungeonMapProjectionSnapshot.EdgeProjection> edges
    ) {
        List<ProjectionData.ProjectionEdge> mapped = new ArrayList<>(edges.size());
        for (TravelDungeonMapProjectionSnapshot.EdgeProjection edge : edges) {
            mapped.add(toProjectionEdge(edge));
        }
        return List.copyOf(mapped);
    }

    private static ProjectionData.ProjectionLabel toProjectionLabel(
            DungeonEditorMapProjectionSnapshot.LabelProjection label
    ) {
        return projectionLabel(
                label.label(),
                label.q(),
                label.r(),
                label.level(),
                label.ownerId(),
                label.clusterId(),
                label.topologyRef().kind(),
                label.topologyRef().id(),
                label.selected(),
                label.preview());
    }

    private static ProjectionData.ProjectionLabel toProjectionLabel(
            TravelDungeonMapProjectionSnapshot.LabelProjection label
    ) {
        return projectionLabel(
                label.label(),
                label.q(),
                label.r(),
                label.level(),
                label.ownerId(),
                label.clusterId(),
                label.topologyRef().kind(),
                label.topologyRef().id(),
                label.selected(),
                label.preview());
    }

    private static ProjectionData.ProjectionLabel projectionLabel(
            String label,
            double q,
            double r,
            int level,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            boolean selected,
            boolean preview
    ) {
        return new ProjectionData.ProjectionLabel(
                label,
                q,
                r,
                level,
                ownerId,
                clusterId,
                new ProjectionData.ProjectionTopologyRef(topologyKind, topologyId),
                selected,
                preview);
    }

    private static List<ProjectionData.ProjectionLabel> toEditorProjectionLabels(
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels
    ) {
        List<ProjectionData.ProjectionLabel> mapped = new ArrayList<>(labels.size());
        for (DungeonEditorMapProjectionSnapshot.LabelProjection label : labels) {
            mapped.add(toProjectionLabel(label));
        }
        return List.copyOf(mapped);
    }

    private static List<ProjectionData.ProjectionLabel> toTravelProjectionLabels(
            List<TravelDungeonMapProjectionSnapshot.LabelProjection> labels
    ) {
        List<ProjectionData.ProjectionLabel> mapped = new ArrayList<>(labels.size());
        for (TravelDungeonMapProjectionSnapshot.LabelProjection label : labels) {
            mapped.add(toProjectionLabel(label));
        }
        return List.copyOf(mapped);
    }

    private static ProjectionData.ProjectionMarker toProjectionMarker(
            DungeonEditorMapProjectionSnapshot.MarkerProjection marker
    ) {
        return projectionMarker(
                marker.label(),
                marker.q(),
                marker.r(),
                marker.level(),
                marker.kind().name(),
                marker.selected(),
                marker.handleRef().kind(),
                marker.handleRef().topologyRef().kind(),
                marker.handleRef().topologyRef().id(),
                marker.handleRef().ownerId(),
                marker.handleRef().clusterId(),
                marker.handleRef().corridorId(),
                marker.handleRef().roomId(),
                marker.handleRef().index(),
                marker.handleRef().cell().q(),
                marker.handleRef().cell().r(),
                marker.handleRef().cell().level(),
                marker.handleRef().direction(),
                marker.preview());
    }

    private static ProjectionData.ProjectionMarker toProjectionMarker(
            TravelDungeonMapProjectionSnapshot.MarkerProjection marker
    ) {
        return projectionMarker(
                marker.label(),
                marker.q(),
                marker.r(),
                marker.level(),
                marker.kind().name(),
                marker.selected(),
                marker.handle().kind(),
                marker.handle().topologyRef().kind(),
                marker.handle().topologyRef().id(),
                marker.handle().ownerId(),
                marker.handle().clusterId(),
                marker.handle().corridorId(),
                marker.handle().roomId(),
                marker.handle().index(),
                marker.handle().q(),
                marker.handle().r(),
                marker.handle().level(),
                marker.handle().direction(),
                marker.preview());
    }

    private static ProjectionData.ProjectionMarker projectionMarker(
            String label,
            double q,
            double r,
            int level,
            String kind,
            boolean selected,
            String handleKind,
            String topologyKind,
            long topologyId,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            int handleQ,
            int handleR,
            int handleLevel,
            String handleDirection,
            boolean preview
    ) {
        return new ProjectionData.ProjectionMarker(
                label,
                q,
                r,
                level,
                toProjectionMarkerKind(kind),
                selected,
                new ProjectionData.ProjectionMarkerHandle(
                        handleKind,
                        new ProjectionData.ProjectionTopologyRef(topologyKind, topologyId),
                        ownerId,
                        clusterId,
                        corridorId,
                        roomId,
                        index,
                        handleQ,
                        handleR,
                        handleLevel,
                        handleDirection),
                preview);
    }

    private static List<ProjectionData.ProjectionMarker> toEditorProjectionMarkers(
            List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers
    ) {
        List<ProjectionData.ProjectionMarker> mapped = new ArrayList<>(markers.size());
        for (DungeonEditorMapProjectionSnapshot.MarkerProjection marker : markers) {
            mapped.add(toProjectionMarker(marker));
        }
        return List.copyOf(mapped);
    }

    private static List<ProjectionData.ProjectionMarker> toTravelProjectionMarkers(
            List<TravelDungeonMapProjectionSnapshot.MarkerProjection> markers
    ) {
        List<ProjectionData.ProjectionMarker> mapped = new ArrayList<>(markers.size());
        for (TravelDungeonMapProjectionSnapshot.MarkerProjection marker : markers) {
            mapped.add(toProjectionMarker(marker));
        }
        return List.copyOf(mapped);
    }

    private static ProjectionData.ProjectionGraphNode toProjectionGraphNode(
            DungeonEditorMapProjectionSnapshot.GraphNodeProjection node
    ) {
        return projectionGraphNode(node.id(), node.clusterId(), node.label(), node.q(), node.r(), node.selected());
    }

    private static ProjectionData.ProjectionGraphNode toProjectionGraphNode(
            TravelDungeonMapProjectionSnapshot.GraphNodeProjection node
    ) {
        return projectionGraphNode(node.id(), node.clusterId(), node.label(), node.q(), node.r(), node.selected());
    }

    private static ProjectionData.ProjectionGraphNode projectionGraphNode(
            long id,
            long clusterId,
            String label,
            double q,
            double r,
            boolean selected
    ) {
        return new ProjectionData.ProjectionGraphNode(id, clusterId, label, q, r, selected);
    }

    private static List<ProjectionData.ProjectionGraphNode> toEditorProjectionGraphNodes(
            List<DungeonEditorMapProjectionSnapshot.GraphNodeProjection> nodes
    ) {
        List<ProjectionData.ProjectionGraphNode> mapped = new ArrayList<>(nodes.size());
        for (DungeonEditorMapProjectionSnapshot.GraphNodeProjection node : nodes) {
            mapped.add(toProjectionGraphNode(node));
        }
        return List.copyOf(mapped);
    }

    private static List<ProjectionData.ProjectionGraphNode> toTravelProjectionGraphNodes(
            List<TravelDungeonMapProjectionSnapshot.GraphNodeProjection> nodes
    ) {
        List<ProjectionData.ProjectionGraphNode> mapped = new ArrayList<>(nodes.size());
        for (TravelDungeonMapProjectionSnapshot.GraphNodeProjection node : nodes) {
            mapped.add(toProjectionGraphNode(node));
        }
        return List.copyOf(mapped);
    }

    private static ProjectionData.ProjectionGraphLink toProjectionGraphLink(
            DungeonEditorMapProjectionSnapshot.GraphLinkProjection link
    ) {
        return new ProjectionData.ProjectionGraphLink(link.fromId(), link.toId(), link.selected());
    }

    private static ProjectionData.ProjectionGraphLink toProjectionGraphLink(
            TravelDungeonMapProjectionSnapshot.GraphLinkProjection link
    ) {
        return new ProjectionData.ProjectionGraphLink(link.fromId(), link.toId(), link.selected());
    }

    private static List<ProjectionData.ProjectionGraphLink> toEditorProjectionGraphLinks(
            List<DungeonEditorMapProjectionSnapshot.GraphLinkProjection> links
    ) {
        List<ProjectionData.ProjectionGraphLink> mapped = new ArrayList<>(links.size());
        for (DungeonEditorMapProjectionSnapshot.GraphLinkProjection link : links) {
            mapped.add(toProjectionGraphLink(link));
        }
        return List.copyOf(mapped);
    }

    private static List<ProjectionData.ProjectionGraphLink> toTravelProjectionGraphLinks(
            List<TravelDungeonMapProjectionSnapshot.GraphLinkProjection> links
    ) {
        List<ProjectionData.ProjectionGraphLink> mapped = new ArrayList<>(links.size());
        for (TravelDungeonMapProjectionSnapshot.GraphLinkProjection link : links) {
            mapped.add(toProjectionGraphLink(link));
        }
        return List.copyOf(mapped);
    }

    private static ProjectionData.@Nullable ProjectionPartyToken toProjectionPartyToken(
            DungeonEditorMapProjectionSnapshot.@Nullable PartyTokenProjection token
    ) {
        if (token == null) {
            return null;
        }
        return projectionPartyToken(
                token.q(),
                token.r(),
                token.level(),
                token.heading().name(),
                token.visible());
    }

    private static ProjectionData.@Nullable ProjectionPartyToken toProjectionPartyToken(
            TravelDungeonMapProjectionSnapshot.@Nullable PartyTokenProjection token
    ) {
        if (token == null) {
            return null;
        }
        return projectionPartyToken(
                token.q(),
                token.r(),
                token.level(),
                token.heading().name(),
                token.visible());
    }

    private static ProjectionData.ProjectionPartyToken projectionPartyToken(
            double q,
            double r,
            int level,
            String heading,
            boolean visible
    ) {
        return new ProjectionData.ProjectionPartyToken(q, r, level, toProjectionHeading(heading), visible);
    }

    private static ProjectionData.ProjectionCellKind toProjectionCellKind(String kind) {
        return switch (kind == null ? "ROOM" : kind) {
            case "CORRIDOR" -> ProjectionData.ProjectionCellKind.CORRIDOR;
            case "STAIR" -> ProjectionData.ProjectionCellKind.STAIR;
            case "TRANSITION" -> ProjectionData.ProjectionCellKind.TRANSITION;
            default -> ProjectionData.ProjectionCellKind.ROOM;
        };
    }

    private static ProjectionData.ProjectionMarkerKind toProjectionMarkerKind(String kind) {
        return switch (kind == null ? "DOOR" : kind) {
            case "STAIR" -> ProjectionData.ProjectionMarkerKind.STAIR;
            case "WAYPOINT" -> ProjectionData.ProjectionMarkerKind.WAYPOINT;
            default -> ProjectionData.ProjectionMarkerKind.DOOR;
        };
    }

    private static ProjectionData.ProjectionHeading toProjectionHeading(String heading) {
        return switch (heading == null ? "SOUTH" : heading) {
            case "NORTH" -> ProjectionData.ProjectionHeading.NORTH;
            case "EAST" -> ProjectionData.ProjectionHeading.EAST;
            case "WEST" -> ProjectionData.ProjectionHeading.WEST;
            default -> ProjectionData.ProjectionHeading.SOUTH;
        };
    }

    private static RenderState.ViewMode toViewMode(DungeonEditorViewMode viewModeKey) {
        return viewModeKey == DungeonEditorViewMode.GRAPH
                ? RenderState.ViewMode.GRAPH
                : RenderState.ViewMode.GRID;
    }

    private static String toolLabel(DungeonEditorTool selectedTool) {
        return switch (selectedTool == null ? DungeonEditorTool.SELECT : selectedTool) {
            case ROOM_PAINT -> "Raum malen";
            case ROOM_DELETE -> "Raum löschen";
            case WALL_CREATE -> "Wand setzen";
            case WALL_DELETE -> "Wand löschen";
            case DOOR_CREATE -> "Tür setzen";
            case DOOR_DELETE -> "Tür löschen";
            case CORRIDOR_CREATE -> "Korridor erstellen";
            case CORRIDOR_DELETE -> "Korridor löschen";
            case STAIR_CREATE -> "Treppe erstellen";
            case STAIR_DELETE -> "Treppe löschen";
            case TRANSITION_CREATE -> "Übergang erstellen";
            case TRANSITION_DELETE -> "Übergang löschen";
            case SELECT -> "Auswahl";
        };
    }

    private static String normalizeTool(String selectedTool) {
        return selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
    }

    private static int atLeastOne(int value) {
        return Math.max(1, value);
    }

    private static <T> List<T> immutableList(@Nullable List<T> items) {
        return items == null ? List.of() : List.copyOf(items);
    }

    private static RenderState.LevelOverlaySettings toOverlaySettings(
            DungeonEditorOverlaySettings overlaySettings
    ) {
        DungeonEditorOverlaySettings safeOverlay =
                overlaySettings == null ? DungeonEditorOverlaySettings.defaults() : overlaySettings;
        return new RenderState.LevelOverlaySettings(
                toOverlayMode(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static RenderState.LevelOverlaySettings toOverlaySettings(
            TravelOverlaySettings overlaySettings
    ) {
        TravelOverlaySettings safeOverlay =
                overlaySettings == null ? TravelOverlaySettings.defaults() : overlaySettings;
        return new RenderState.LevelOverlaySettings(
                toOverlayMode(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static RenderState.OverlayMode toOverlayMode(String modeKey) {
        if ("NEARBY".equalsIgnoreCase(modeKey)) {
            return RenderState.OverlayMode.NEARBY;
        }
        if ("SELECTED".equalsIgnoreCase(modeKey)) {
            return RenderState.OverlayMode.SELECTED;
        }
        return RenderState.OverlayMode.OFF;
    }

    private record ProjectionData(
            String mapName,
            ProjectionData.ProjectionTopologyKind topology,
            int width,
            int height,
            List<ProjectionData.ProjectionCell> cells,
            List<ProjectionData.ProjectionEdge> edges,
            List<ProjectionData.ProjectionLabel> labels,
            List<ProjectionData.ProjectionMarker> markers,
            List<ProjectionData.ProjectionGraphNode> graphNodes,
            List<ProjectionData.ProjectionGraphLink> graphLinks,
            @Nullable ProjectionPartyToken partyToken
    ) {

        private ProjectionData {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
            topology = topology == null ? ProjectionTopologyKind.SQUARE : topology;
            width = atLeastOne(width);
            height = atLeastOne(height);
            cells = immutableList(cells);
            edges = immutableList(edges);
            labels = immutableList(labels);
            markers = immutableList(markers);
            graphNodes = immutableList(graphNodes);
            graphLinks = immutableList(graphLinks);
        }

        private enum ProjectionTopologyKind {
            SQUARE,
            HEX
        }

        private enum ProjectionCellKind {
            ROOM,
            CORRIDOR,
            STAIR,
            TRANSITION
        }

        private enum ProjectionEdgeKind {
            WALL,
            DOOR
        }

        private enum ProjectionMarkerKind {
            DOOR,
            STAIR,
            WAYPOINT
        }

        private enum ProjectionHeading {
            NORTH,
            EAST,
            SOUTH,
            WEST
        }

        private record ProjectionTopologyRef(String kind, long id) {

            private ProjectionTopologyRef {
                kind = kind == null || kind.isBlank() ? "EMPTY" : kind.trim();
                id = Math.max(0L, id);
            }
        }

        private record ProjectionMarkerHandle(
                String kind,
                ProjectionData.ProjectionTopologyRef topologyRef,
                long ownerId,
                long clusterId,
                long corridorId,
                long roomId,
                int index,
                int q,
                int r,
                int level,
                String direction
        ) {

            private ProjectionMarkerHandle {
                kind = kind == null || kind.isBlank() ? "EMPTY" : kind.trim();
                topologyRef = topologyRef == null
                        ? new ProjectionData.ProjectionTopologyRef("EMPTY", 0L)
                        : topologyRef;
                ownerId = Math.max(0L, ownerId);
                clusterId = Math.max(0L, clusterId);
                corridorId = Math.max(0L, corridorId);
                roomId = Math.max(0L, roomId);
                index = Math.max(0, index);
                direction = direction == null ? "" : direction.trim();
            }
        }

        private record ProjectionCell(
                int q,
                int r,
                int level,
                String label,
                ProjectionData.ProjectionCellKind kind,
                long ownerId,
                long clusterId,
                ProjectionData.ProjectionTopologyRef topologyRef,
                boolean selected,
                boolean overlay,
                boolean preview,
                boolean destructivePreview
        ) {
        }

        private record ProjectionEdge(
                double startQ,
                double startR,
                double endQ,
                double endR,
                int level,
                ProjectionData.ProjectionEdgeKind kind,
                String label,
                long ownerId,
                ProjectionData.ProjectionTopologyRef topologyRef,
                boolean selected,
                boolean preview
        ) {
        }

        private record ProjectionLabel(
                String label,
                double q,
                double r,
                int level,
                long ownerId,
                long clusterId,
                ProjectionData.ProjectionTopologyRef topologyRef,
                boolean selected,
                boolean preview
        ) {
        }

        private record ProjectionMarker(
                String label,
                double q,
                double r,
                int level,
                ProjectionData.ProjectionMarkerKind kind,
                boolean selected,
                ProjectionData.ProjectionMarkerHandle handle,
                boolean preview
        ) {
        }

        private record ProjectionGraphNode(
                long id,
                long clusterId,
                String label,
                double q,
                double r,
                boolean selected
        ) {
        }

        private record ProjectionGraphLink(long fromId, long toId, boolean selected) {
        }

        private record ProjectionPartyToken(
                double q,
                double r,
                int level,
                ProjectionData.ProjectionHeading heading,
                boolean visible
        ) {
        }
    }

    public static record RenderState(
            String title,
            String subtitle,
            String modeLabel,
            String statusLabel,
            String summaryLabel,
            boolean mapLoaded,
            String overlayMessage,
            RenderTopology topology,
            ViewMode viewMode,
            LevelOverlaySettings overlaySettings,
            int projectionLevel,
            boolean editorMode,
            String selectedTool,
            List<RenderCell> cells,
            List<RenderEdge> edges,
            List<RenderLabel> labels,
            List<RenderMarker> markers,
            List<RenderState.GraphNode> graphNodes,
            List<RenderState.GraphLink> graphLinks,
            @Nullable PartyToken partyToken
    ) {

        public RenderState {
            title = title == null || title.isBlank() ? "Dungeon Map" : title;
            subtitle = subtitle == null ? "" : subtitle;
            modeLabel = modeLabel == null ? "" : modeLabel;
            statusLabel = statusLabel == null ? "" : statusLabel;
            summaryLabel = summaryLabel == null ? "" : summaryLabel;
            overlayMessage = overlayMessage == null ? "" : overlayMessage;
            topology = topology == null ? RenderTopology.SQUARE : topology;
            viewMode = viewMode == null ? ViewMode.GRID : viewMode;
            overlaySettings = overlaySettings == null ? LevelOverlaySettings.defaults() : overlaySettings;
            selectedTool = selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
            cells = immutableList(cells);
            edges = immutableList(edges);
            labels = immutableList(labels);
            markers = immutableList(markers);
            graphNodes = immutableList(graphNodes);
            graphLinks = immutableList(graphLinks);
        }

        public OverlayMode overlayMode() {
            return overlaySettings.mode();
        }

        @Override
        public List<RenderCell> cells() {
            return immutableList(cells);
        }

        @Override
        public List<RenderEdge> edges() {
            return immutableList(edges);
        }

        @Override
        public List<RenderLabel> labels() {
            return immutableList(labels);
        }

        @Override
        public List<RenderMarker> markers() {
            return immutableList(markers);
        }

        @Override
        public List<RenderState.GraphNode> graphNodes() {
            return immutableList(graphNodes);
        }

        @Override
        public List<RenderState.GraphLink> graphLinks() {
            return immutableList(graphLinks);
        }

        public static RenderState empty() {
            return empty("Dungeon Map");
        }

        public static RenderState empty(String title) {
            return new RenderState(
                    title,
                    "",
                    "Grid",
                    "",
                    "",
                    false,
                    "No dungeon map loaded.",
                    RenderTopology.SQUARE,
                    ViewMode.GRID,
                    LevelOverlaySettings.off(),
                    0,
                    true,
                    "Auswahl",
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    null);
        }

        public static RenderState fromProjection(
                @Nullable ProjectionData projection,
                String placeholderTitle,
                boolean editorMode,
                ViewMode viewMode,
                LevelOverlaySettings overlaySettings,
                int projectionLevel,
                String selectedTool
        ) {
            if (projection == null) {
                return empty(placeholderTitle);
            }
            LevelOverlaySettings resolvedOverlay = overlaySettings == null
                    ? LevelOverlaySettings.defaults()
                    : overlaySettings;
            List<RenderCell> cells = projection.cells().stream()
                    .map(cell -> new RenderCell(
                            cell.q(),
                            cell.r(),
                            cell.level(),
                            cell.label(),
                            toCellKind(cell.kind()),
                            cell.ownerId(),
                            cell.clusterId(),
                            new RenderState.TopologyRef(cell.topologyRef().kind(), cell.topologyRef().id()),
                            cell.selected(),
                            cell.overlay(),
                            cell.preview(),
                            cell.destructivePreview()))
                    .toList();
            List<RenderEdge> edges = projection.edges().stream()
                    .map(edge -> new RenderEdge(
                            edge.startQ(),
                            edge.startR(),
                            edge.endQ(),
                            edge.endR(),
                            edge.level(),
                            edge.kind() == ProjectionData.ProjectionEdgeKind.DOOR
                                    ? RenderState.EdgeKind.DOOR
                                    : RenderState.EdgeKind.WALL,
                            edge.label(),
                            edge.ownerId(),
                            new RenderState.TopologyRef(edge.topologyRef().kind(), edge.topologyRef().id()),
                            edge.selected(),
                            edge.preview()))
                    .toList();
            List<RenderLabel> labels = projection.labels().stream()
                    .map(label -> new RenderLabel(
                            label.label(),
                            label.q(),
                            label.r(),
                            label.level(),
                            label.ownerId(),
                            label.clusterId(),
                            new RenderState.TopologyRef(label.topologyRef().kind(), label.topologyRef().id()),
                            label.selected(),
                            label.preview()))
                    .toList();
            List<RenderMarker> markers = projection.markers().stream()
                    .map(RenderState::toRenderMarker)
                    .toList();
            List<RenderState.GraphNode> graphNodes = projection.graphNodes().stream()
                    .map(node -> new RenderState.GraphNode(
                            node.id(), node.clusterId(), node.label(), node.q(), node.r(), node.selected()))
                    .toList();
            List<RenderState.GraphLink> graphLinks = projection.graphLinks().stream()
                    .map(link -> new RenderState.GraphLink(link.fromId(), link.toId(), link.selected()))
                    .toList();
            boolean mapLoaded = !(cells.isEmpty()
                    && edges.isEmpty()
                    && labels.isEmpty()
                    && markers.isEmpty()
                    && graphNodes.isEmpty());
            return new RenderState(
                    projection.mapName(),
                    projection.width() + " x " + projection.height() + " grid · z=" + projectionLevel,
                    (viewMode == null ? ViewMode.GRID : viewMode).label(),
                    editorMode ? normalizeTool(selectedTool) : "Token auf der Karte ziehen",
                    cells.size() + " cells, " + edges.size() + " edges · " + resolvedOverlay.mode().label(),
                    mapLoaded,
                    mapLoaded ? "" : "No dungeon map geometry available.",
                    projection.topology() == ProjectionData.ProjectionTopologyKind.HEX
                            ? RenderTopology.HEX
                            : RenderTopology.SQUARE,
                    viewMode == null ? ViewMode.GRID : viewMode,
                    resolvedOverlay,
                    projectionLevel,
                    editorMode,
                    normalizeTool(selectedTool),
                    cells,
                    edges,
                    labels,
                    markers,
                    graphNodes,
                    graphLinks,
                    editorMode || projection.partyToken() == null
                            ? null
                            : new RenderState.PartyToken(
                                    projection.partyToken().q(),
                                    projection.partyToken().r(),
                                    projection.partyToken().level(),
                                    toHeading(projection.partyToken().heading()),
                                    projection.partyToken().visible()));
        }

        private static RenderState.CellKind toCellKind(ProjectionData.ProjectionCellKind kind) {
            return switch (kind == null ? ProjectionData.ProjectionCellKind.ROOM : kind) {
                case ROOM -> RenderState.CellKind.ROOM;
                case CORRIDOR -> RenderState.CellKind.CORRIDOR;
                case STAIR -> RenderState.CellKind.STAIR;
                case TRANSITION -> RenderState.CellKind.TRANSITION;
            };
        }

        private static RenderState.MarkerKind toMarkerKind(ProjectionData.ProjectionMarkerKind kind) {
            return switch (kind == null ? ProjectionData.ProjectionMarkerKind.DOOR : kind) {
                case DOOR -> RenderState.MarkerKind.DOOR;
                case STAIR -> RenderState.MarkerKind.STAIR;
                case WAYPOINT -> RenderState.MarkerKind.WAYPOINT;
            };
        }

        private static RenderMarker toRenderMarker(ProjectionData.ProjectionMarker marker) {
            ProjectionData.ProjectionMarkerHandle handle = marker.handle();
            return new RenderMarker(
                    marker.label(),
                    marker.q(),
                    marker.r(),
                    marker.level(),
                    toMarkerKind(marker.kind()),
                    marker.selected(),
                    handle.kind(),
                    handle.topologyRef().kind(),
                    handle.topologyRef().id(),
                    handle.ownerId(),
                    handle.clusterId(),
                    handle.corridorId(),
                    handle.roomId(),
                    handle.index(),
                    handle.q(),
                    handle.r(),
                    handle.level(),
                    handle.direction(),
                    marker.preview());
        }

        private static RenderState.Heading toHeading(ProjectionData.ProjectionHeading heading) {
            return switch (heading == null ? ProjectionData.ProjectionHeading.SOUTH : heading) {
                case NORTH -> RenderState.Heading.NORTH;
                case EAST -> RenderState.Heading.EAST;
                case SOUTH -> RenderState.Heading.SOUTH;
                case WEST -> RenderState.Heading.WEST;
            };
        }

        public enum RenderTopology {
            SQUARE,
            HEX
        }

        public enum ViewMode {
            GRID("Grid"),
            GRAPH("Graph");

            private final String label;

            ViewMode(String label) {
                this.label = label;
            }

            public String label() {
                return label;
            }
        }

        public enum OverlayMode {
            OFF("Overlay: Aus"),
            NEARBY("Overlay: Nachbarn"),
            SELECTED("Overlay: Auswahl");

            private final String label;

            OverlayMode(String label) {
                this.label = label;
            }

            public String label() {
                return label;
            }
        }

        public record LevelOverlaySettings(
                OverlayMode mode,
                int levelRange,
                double opacity,
                List<Integer> selectedLevels
        ) {

            private static final int DEFAULT_LEVEL_RANGE = 2;
            private static final int MAX_LEVEL_RANGE = 6;
            private static final double DEFAULT_OPACITY = 0.35;

            public LevelOverlaySettings {
                mode = mode == null ? OverlayMode.OFF : mode;
                levelRange = Math.max(1, Math.min(MAX_LEVEL_RANGE, levelRange));
                opacity = Math.max(0.05, Math.min(0.95, opacity));
                selectedLevels = selectedLevels == null ? List.of() : selectedLevels.stream()
                        .filter(java.util.Objects::nonNull)
                        .distinct()
                        .sorted()
                        .toList();
            }

            @Override
            public List<Integer> selectedLevels() {
                return immutableList(selectedLevels);
            }

            public boolean selectsLevel(int level) {
                return selectedLevels().contains(level);
            }

            public static LevelOverlaySettings defaults() {
                return new LevelOverlaySettings(OverlayMode.NEARBY, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
            }

            public static LevelOverlaySettings off() {
                return new LevelOverlaySettings(OverlayMode.OFF, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
            }

            public static LevelOverlaySettings of(OverlayMode mode) {
                return new LevelOverlaySettings(mode, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
            }
        }

        public enum CellKind {
            ROOM,
            CORRIDOR,
            STAIR,
            TRANSITION
        }

        public enum EdgeKind {
            WALL,
            DOOR
        }

        public enum MarkerKind {
            DOOR,
            STAIR,
            TRANSITION,
            WAYPOINT,
            CLUSTER
        }

        public enum Heading {
            NORTH(0.0, -1.0),
            EAST(1.0, 0.0),
            SOUTH(0.0, 1.0),
            WEST(-1.0, 0.0);

            private final double dx;
            private final double dy;

            Heading(double dx, double dy) {
                this.dx = dx;
                this.dy = dy;
            }

            public double dx() {
                return dx;
            }

            public double dy() {
                return dy;
            }
        }

        public record RenderCell(
                int q,
                int r,
                int z,
                String label,
                RenderState.CellKind kind,
                long ownerId,
                long clusterId,
                RenderState.TopologyRef topologyRef,
                boolean selected,
                boolean overlay,
                boolean preview,
                boolean destructivePreview
        ) {

            public RenderCell {
                label = label == null ? "" : label;
                kind = kind == null ? RenderState.CellKind.ROOM : kind;
                topologyRef = topologyRef == null ? RenderState.TopologyRef.empty() : topologyRef;
            }
        }

        public record RenderEdge(
                double startQ,
                double startR,
                double endQ,
                double endR,
                int z,
                RenderState.EdgeKind kind,
                String label,
                long ownerId,
                RenderState.TopologyRef topologyRef,
                boolean selected,
                boolean preview
        ) {

            public RenderEdge {
                kind = kind == null ? RenderState.EdgeKind.WALL : kind;
                label = label == null ? "" : label;
                topologyRef = topologyRef == null ? RenderState.TopologyRef.empty() : topologyRef;
            }
        }

        public record RenderLabel(
                String label,
                double q,
                double r,
                int z,
                long ownerId,
                long clusterId,
                RenderState.TopologyRef topologyRef,
                boolean selected,
                boolean preview
        ) {

            public RenderLabel {
                label = label == null ? "" : label;
                topologyRef = topologyRef == null ? RenderState.TopologyRef.empty() : topologyRef;
            }
        }

        public record RenderMarker(
                String label,
                double q,
                double r,
                int z,
                RenderState.MarkerKind kind,
                boolean selected,
                String handleKind,
                String handleTopologyRefKind,
                long handleTopologyRefId,
                long handleOwnerId,
                long handleClusterId,
                long handleCorridorId,
                long handleRoomId,
                int handleIndex,
                int handleQ,
                int handleR,
                int handleLevel,
                String handleDirection,
                boolean preview
        ) {

            public RenderMarker {
                label = label == null ? "" : label;
                kind = kind == null ? RenderState.MarkerKind.DOOR : kind;
                handleKind = normalizeHandleField(handleKind);
                handleTopologyRefKind = normalizeHandleField(handleTopologyRefKind);
                handleDirection = handleDirection == null ? "" : handleDirection;
            }

            private static String normalizeHandleField(String value) {
                return value == null || value.isBlank() ? "EMPTY" : value;
            }
        }

        public record GraphNode(long id, long clusterId, String label, double q, double r, boolean selected) {

            public GraphNode {
                label = label == null || label.isBlank() ? "Room" : label;
            }
        }

        public record GraphLink(long fromId, long toId, boolean selected) {
        }

        public record PartyToken(double q, double r, int z, RenderState.Heading heading, boolean visible) {

            public PartyToken {
                heading = heading == null ? RenderState.Heading.SOUTH : heading;
            }
        }

        public record TopologyRef(String kind, long id) {

            public TopologyRef {
                kind = kind == null || kind.isBlank() ? "EMPTY" : kind.trim();
                id = Math.max(0L, id);
            }

            public static RenderState.TopologyRef empty() {
                return new RenderState.TopologyRef("EMPTY", 0L);
            }
        }
    }
}
