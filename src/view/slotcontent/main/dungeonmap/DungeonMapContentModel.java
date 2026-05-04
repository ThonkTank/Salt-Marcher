package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
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
        viewMode = toViewMode(safeSnapshot.viewModeKey());
        overlaySettings = toOverlaySettings(safeSnapshot.overlaySettings());
        projectionLevel = safeSnapshot.projectionLevel();
        selectedTool = normalizeTool(safeSnapshot.selectedTool());
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
        return projection == null ? null : toProjection(
                projection.mapName(),
                toProjectionTopology(projection.topology()),
                projection.width(),
                projection.height(),
                projection.cells(),
                projection.edges(),
                projection.labels(),
                projection.markers(),
                projection.graphNodes(),
                projection.graphLinks(),
                projection.partyToken());
    }

    private static @Nullable ProjectionData toProjection(
            @Nullable TravelDungeonMapProjectionSnapshot projection
    ) {
        return projection == null ? null : toProjection(
                projection.mapName(),
                toProjectionTopology(projection.topology()),
                projection.width(),
                projection.height(),
                projection.cells(),
                projection.edges(),
                projection.labels(),
                projection.markers(),
                projection.graphNodes(),
                projection.graphLinks(),
                projection.partyToken());
    }

    private static ProjectionData toProjection(
            String mapName,
            ProjectionTopologyKind topology,
            int width,
            int height,
            List<?> cells,
            List<?> edges,
            List<?> labels,
            List<?> markers,
            List<?> graphNodes,
            List<?> graphLinks,
            @Nullable Object partyToken
    ) {
        return new ProjectionData(
                mapName,
                topology,
                width,
                height,
                cells.stream().map(DungeonMapContentModel::toProjectionCell).toList(),
                edges.stream().map(DungeonMapContentModel::toProjectionEdge).toList(),
                labels.stream().map(DungeonMapContentModel::toProjectionLabel).toList(),
                markers.stream().map(DungeonMapContentModel::toProjectionMarker).toList(),
                graphNodes.stream().map(DungeonMapContentModel::toProjectionGraphNode).toList(),
                graphLinks.stream().map(DungeonMapContentModel::toProjectionGraphLink).toList(),
                toProjectionPartyToken(partyToken));
    }

    private static ProjectionTopologyKind toProjectionTopology(
            DungeonEditorMapProjectionSnapshot.TopologyKind topology
    ) {
        return topology == DungeonEditorMapProjectionSnapshot.TopologyKind.HEX
                ? ProjectionTopologyKind.HEX
                : ProjectionTopologyKind.SQUARE;
    }

    private static ProjectionTopologyKind toProjectionTopology(
            TravelDungeonMapProjectionSnapshot.TopologyKind topology
    ) {
        return topology == TravelDungeonMapProjectionSnapshot.TopologyKind.HEX
                ? ProjectionTopologyKind.HEX
                : ProjectionTopologyKind.SQUARE;
    }

    private static ProjectionCell toProjectionCell(Object cellSource) {
        if (cellSource instanceof DungeonEditorMapProjectionSnapshot.CellProjection cell) {
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
        if (cellSource instanceof TravelDungeonMapProjectionSnapshot.CellProjection cell) {
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
        throw unsupportedProjectionSource(cellSource, "cell");
    }

    private static ProjectionCell projectionCell(
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
        return new ProjectionCell(
                q,
                r,
                level,
                label,
                toProjectionCellKind(kind),
                ownerId,
                clusterId,
                new ProjectionTopologyRef(topologyKind, topologyId),
                selected,
                overlay,
                preview,
                destructivePreview);
    }

    private static ProjectionEdge toProjectionEdge(Object edgeSource) {
        if (edgeSource instanceof DungeonEditorMapProjectionSnapshot.EdgeProjection edge) {
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
        if (edgeSource instanceof TravelDungeonMapProjectionSnapshot.EdgeProjection edge) {
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
        throw unsupportedProjectionSource(edgeSource, "edge");
    }

    private static ProjectionEdge projectionEdge(
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
        return new ProjectionEdge(
                startQ,
                startR,
                endQ,
                endR,
                level,
                "DOOR".equalsIgnoreCase(kind)
                        ? ProjectionEdgeKind.DOOR
                        : ProjectionEdgeKind.WALL,
                label,
                ownerId,
                new ProjectionTopologyRef(topologyKind, topologyId),
                selected,
                preview);
    }

    private static ProjectionLabel toProjectionLabel(Object labelSource) {
        if (labelSource instanceof DungeonEditorMapProjectionSnapshot.LabelProjection label) {
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
        if (labelSource instanceof TravelDungeonMapProjectionSnapshot.LabelProjection label) {
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
        throw unsupportedProjectionSource(labelSource, "label");
    }

    private static ProjectionLabel projectionLabel(
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
        return new ProjectionLabel(
                label,
                q,
                r,
                level,
                ownerId,
                clusterId,
                new ProjectionTopologyRef(topologyKind, topologyId),
                selected,
                preview);
    }

    private static ProjectionMarker toProjectionMarker(Object markerSource) {
        if (markerSource instanceof DungeonEditorMapProjectionSnapshot.MarkerProjection marker) {
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
        if (markerSource instanceof TravelDungeonMapProjectionSnapshot.MarkerProjection marker) {
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
        throw unsupportedProjectionSource(markerSource, "marker");
    }

    private static ProjectionMarker projectionMarker(
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
        return new ProjectionMarker(
                label,
                q,
                r,
                level,
                toProjectionMarkerKind(kind),
                selected,
                new ProjectionMarkerHandle(
                        handleKind,
                        new ProjectionTopologyRef(topologyKind, topologyId),
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

    private static ProjectionGraphNode toProjectionGraphNode(Object nodeSource) {
        if (nodeSource instanceof DungeonEditorMapProjectionSnapshot.GraphNodeProjection node) {
            return projectionGraphNode(node.id(), node.clusterId(), node.label(), node.q(), node.r(), node.selected());
        }
        if (nodeSource instanceof TravelDungeonMapProjectionSnapshot.GraphNodeProjection node) {
            return projectionGraphNode(node.id(), node.clusterId(), node.label(), node.q(), node.r(), node.selected());
        }
        throw unsupportedProjectionSource(nodeSource, "graph node");
    }

    private static ProjectionGraphNode projectionGraphNode(
            long id,
            long clusterId,
            String label,
            double q,
            double r,
            boolean selected
    ) {
        return new ProjectionGraphNode(id, clusterId, label, q, r, selected);
    }

    private static ProjectionGraphLink toProjectionGraphLink(Object linkSource) {
        if (linkSource instanceof DungeonEditorMapProjectionSnapshot.GraphLinkProjection link) {
            return new ProjectionGraphLink(link.fromId(), link.toId(), link.selected());
        }
        if (linkSource instanceof TravelDungeonMapProjectionSnapshot.GraphLinkProjection link) {
            return new ProjectionGraphLink(link.fromId(), link.toId(), link.selected());
        }
        throw unsupportedProjectionSource(linkSource, "graph link");
    }

    private static @Nullable ProjectionPartyToken toProjectionPartyToken(@Nullable Object partyToken) {
        if (partyToken instanceof DungeonEditorMapProjectionSnapshot.PartyTokenProjection token) {
            return projectionPartyToken(
                    token.q(),
                    token.r(),
                    token.level(),
                    token.heading().name(),
                    token.visible());
        }
        if (partyToken instanceof TravelDungeonMapProjectionSnapshot.PartyTokenProjection token) {
            return projectionPartyToken(
                    token.q(),
                    token.r(),
                    token.level(),
                    token.heading().name(),
                    token.visible());
        }
        if (partyToken == null) {
            return null;
        }
        throw unsupportedProjectionSource(partyToken, "party token");
    }

    private static ProjectionPartyToken projectionPartyToken(
            double q,
            double r,
            int level,
            String heading,
            boolean visible
    ) {
        return new ProjectionPartyToken(q, r, level, toProjectionHeading(heading), visible);
    }

    private static IllegalArgumentException unsupportedProjectionSource(Object source, String role) {
        String type = source == null ? "null" : source.getClass().getName();
        return new IllegalArgumentException("Unsupported " + role + " projection source: " + type);
    }

    private static ProjectionCellKind toProjectionCellKind(String kind) {
        return switch (kind == null ? "ROOM" : kind) {
            case "CORRIDOR" -> ProjectionCellKind.CORRIDOR;
            case "STAIR" -> ProjectionCellKind.STAIR;
            case "TRANSITION" -> ProjectionCellKind.TRANSITION;
            default -> ProjectionCellKind.ROOM;
        };
    }

    private static ProjectionMarkerKind toProjectionMarkerKind(String kind) {
        return switch (kind == null ? "DOOR" : kind) {
            case "STAIR" -> ProjectionMarkerKind.STAIR;
            case "WAYPOINT" -> ProjectionMarkerKind.WAYPOINT;
            default -> ProjectionMarkerKind.DOOR;
        };
    }

    private static ProjectionHeading toProjectionHeading(String heading) {
        return switch (heading == null ? "SOUTH" : heading) {
            case "NORTH" -> ProjectionHeading.NORTH;
            case "EAST" -> ProjectionHeading.EAST;
            case "WEST" -> ProjectionHeading.WEST;
            default -> ProjectionHeading.SOUTH;
        };
    }

    private static RenderState.ViewMode toViewMode(String viewModeKey) {
        return "GRAPH".equalsIgnoreCase(viewModeKey)
                ? RenderState.ViewMode.GRAPH
                : RenderState.ViewMode.GRID;
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
            ProjectionTopologyRef topologyRef,
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
                    ? new ProjectionTopologyRef("EMPTY", 0L)
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
            ProjectionCellKind kind,
            long ownerId,
            long clusterId,
            ProjectionTopologyRef topologyRef,
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
            ProjectionEdgeKind kind,
            String label,
            long ownerId,
            ProjectionTopologyRef topologyRef,
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
            ProjectionTopologyRef topologyRef,
            boolean selected,
            boolean preview
    ) {
    }

    private record ProjectionMarker(
            String label,
            double q,
            double r,
            int level,
            ProjectionMarkerKind kind,
            boolean selected,
            ProjectionMarkerHandle handle,
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
            ProjectionHeading heading,
            boolean visible
    ) {
    }

    private record ProjectionData(
            String mapName,
            ProjectionTopologyKind topology,
            int width,
            int height,
            List<ProjectionCell> cells,
            List<ProjectionEdge> edges,
            List<ProjectionLabel> labels,
            List<ProjectionMarker> markers,
            List<ProjectionGraphNode> graphNodes,
            List<ProjectionGraphLink> graphLinks,
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

        public OverlayMode overlayMode() {
            return overlaySettings.mode();
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
                            edge.kind() == ProjectionEdgeKind.DOOR
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
                    projection.topology() == ProjectionTopologyKind.HEX
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

        private static RenderState.CellKind toCellKind(ProjectionCellKind kind) {
            return switch (kind == null ? ProjectionCellKind.ROOM : kind) {
                case ROOM -> RenderState.CellKind.ROOM;
                case CORRIDOR -> RenderState.CellKind.CORRIDOR;
                case STAIR -> RenderState.CellKind.STAIR;
                case TRANSITION -> RenderState.CellKind.TRANSITION;
            };
        }

        private static RenderState.MarkerKind toMarkerKind(ProjectionMarkerKind kind) {
            return switch (kind == null ? ProjectionMarkerKind.DOOR : kind) {
                case DOOR -> RenderState.MarkerKind.DOOR;
                case STAIR -> RenderState.MarkerKind.STAIR;
                case WAYPOINT -> RenderState.MarkerKind.WAYPOINT;
            };
        }

        private static RenderMarker toRenderMarker(ProjectionMarker marker) {
            ProjectionMarkerHandle handle = marker.handle();
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

        private static RenderState.Heading toHeading(ProjectionHeading heading) {
            return switch (heading == null ? ProjectionHeading.SOUTH : heading) {
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
                return selectedLevels.contains(level);
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
