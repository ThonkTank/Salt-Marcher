package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;

/**
 * Display-owned render contract consumed by the reusable dungeon map view.
 */
public record DungeonMapDisplayModel(
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
        @Nullable Selection selection,
        @Nullable DragPreview dragPreview,
        @Nullable PaintPreview paintPreview,
        List<RenderCell> cells,
        List<RenderEdge> edges,
        List<RenderLabel> labels,
        List<RenderMarker> markers,
        List<GraphNode> graphNodes,
        List<GraphLink> graphLinks,
        @Nullable PartyToken partyToken
) {

    public DungeonMapDisplayModel {
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
        cells = cells == null ? List.of() : List.copyOf(cells);
        edges = edges == null ? List.of() : List.copyOf(edges);
        labels = labels == null ? List.of() : List.copyOf(labels);
        markers = markers == null ? List.of() : List.copyOf(markers);
        graphNodes = graphNodes == null ? List.of() : List.copyOf(graphNodes);
        graphLinks = graphLinks == null ? List.of() : List.copyOf(graphLinks);
    }

    public OverlayMode overlayMode() {
        return overlaySettings.mode();
    }

    public static DungeonMapDisplayModel empty() {
        return empty("Dungeon Map");
    }

    public static DungeonMapDisplayModel empty(String title) {
        return new DungeonMapDisplayModel(
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
                null,
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null);
    }

    public static DungeonMapDisplayModel fromDungeonSnapshot(
            @Nullable DungeonSnapshot snapshot,
            String placeholderTitle,
            boolean editorMode,
            ViewMode viewMode,
            OverlayMode overlayMode,
            int projectionLevel,
            String selectedTool
    ) {
        return fromDungeonSnapshot(
                snapshot,
                placeholderTitle,
                editorMode,
                viewMode,
                LevelOverlaySettings.of(overlayMode),
                projectionLevel,
                selectedTool,
                null);
    }

    public static DungeonMapDisplayModel fromDungeonSnapshot(
            @Nullable DungeonSnapshot snapshot,
            String placeholderTitle,
            boolean editorMode,
            ViewMode viewMode,
            OverlayMode overlayMode,
            int projectionLevel,
            String selectedTool,
            @Nullable PartyToken runtimePartyToken
    ) {
        return fromDungeonSnapshot(
                snapshot,
                placeholderTitle,
                editorMode,
                viewMode,
                LevelOverlaySettings.of(overlayMode),
                projectionLevel,
                selectedTool,
                null,
                null,
                null,
                runtimePartyToken);
    }

    public static DungeonMapDisplayModel fromDungeonSnapshot(
            @Nullable DungeonSnapshot snapshot,
            String placeholderTitle,
            boolean editorMode,
            ViewMode viewMode,
            LevelOverlaySettings overlaySettings,
            int projectionLevel,
            String selectedTool,
            @Nullable PartyToken runtimePartyToken
    ) {
        return fromDungeonSnapshot(
                snapshot,
                placeholderTitle,
                editorMode,
                viewMode,
                overlaySettings,
                projectionLevel,
                selectedTool,
                null,
                null,
                null,
                runtimePartyToken);
    }

    public static DungeonMapDisplayModel fromDungeonSnapshot(
            @Nullable DungeonSnapshot snapshot,
            String placeholderTitle,
            boolean editorMode,
            ViewMode viewMode,
            LevelOverlaySettings overlaySettings,
            int projectionLevel,
            String selectedTool,
            @Nullable Selection selection,
            @Nullable DragPreview dragPreview,
            @Nullable PaintPreview paintPreview,
            @Nullable PartyToken runtimePartyToken
    ) {
        if (snapshot == null) {
            return empty(placeholderTitle);
        }
        LevelOverlaySettings resolvedOverlay = overlaySettings == null
                ? LevelOverlaySettings.defaults()
                : overlaySettings;
        DungeonMapSnapshot map = snapshot.map();
        List<RenderCell> renderedCells = new ArrayList<>();
        List<RenderEdge> renderedEdges = new ArrayList<>();
        List<RenderLabel> renderedLabels = new ArrayList<>();
        List<RenderMarker> renderedMarkers = new ArrayList<>();
        List<GraphNode> graphNodes = new ArrayList<>();
        List<GraphLink> graphLinks = new ArrayList<>();

        for (DungeonAreaSnapshot area : map.areas()) {
            if (dragPreview != null && draggedClusterArea(area, selection, dragPreview)) {
                addClusterDragPreview(renderedCells, renderedLabels, graphNodes, area, dragPreview);
                continue;
            }
            List<RenderCell> areaCells = area.cells().stream()
                    .map(cell -> renderCell(area, cell, selectedArea(area, selection), false, 0, 0))
                    .toList();
            renderedCells.addAll(areaCells);
            if (!areaCells.isEmpty()) {
                CellCenter center = centerOf(areaCells);
                boolean selected = selectedArea(area, selection);
                renderedLabels.add(new RenderLabel(
                        area.label(),
                        center.x(),
                        center.y(),
                        areaCells.getFirst().z(),
                        area.id(),
                        area.clusterId(),
                        topologyRef(area.topologyRef()),
                        selected));
                graphNodes.add(new GraphNode(area.id(), area.clusterId(), area.label(), center.x(), center.y(), selected));
            }
        }
        if (paintPreview != null && paintPreview.active()) {
            addPaintPreview(renderedCells, paintPreview);
        }
        for (DungeonBoundarySnapshot boundary : map.boundaries()) {
            if (boundary.edge() == null || boundary.edge().from() == null || boundary.edge().to() == null) {
                continue;
            }
            renderedEdges.add(renderEdge(boundary));
        }
        for (DungeonFeatureSnapshot feature : map.features()) {
            List<RenderCell> featureCells = feature.cells().stream()
                    .map(cell -> renderFeatureCell(feature, cell, selection))
                    .toList();
            renderedCells.addAll(featureCells);
            if (!featureCells.isEmpty()) {
                CellCenter center = centerOf(featureCells);
                boolean selected = selectedFeature(feature, selection);
                renderedLabels.add(new RenderLabel(
                        feature.label(),
                        center.x(),
                        center.y(),
                        featureCells.getFirst().z(),
                        feature.id(),
                        0L,
                        topologyRef(feature.topologyRef()),
                        selected));
                renderedMarkers.add(markerForFeature(feature, center, featureCells.getFirst().z(), selected));
            }
        }
        for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
            if (draggedHandle(handle.ref(), dragPreview)) {
                continue;
            }
            renderedMarkers.add(markerForHandle(handle, selection));
        }
        addHandleDragPreview(renderedMarkers, dragPreview);
        if (renderedCells.isEmpty()) {
            addRepresentativeGeometry(renderedCells, renderedEdges, renderedLabels, graphNodes, graphLinks);
            renderedMarkers.addAll(representativeMarkers(selectedTool));
        }
        if (graphLinks.isEmpty() && graphNodes.size() > 1) {
            for (int index = 1; index < graphNodes.size(); index++) {
                graphLinks.add(new GraphLink(graphNodes.get(index - 1).id(), graphNodes.get(index).id(), false));
            }
        }
        boolean mapLoaded = !renderedCells.isEmpty();
        return new DungeonMapDisplayModel(
                snapshot.mapName(),
                map.width() + " x " + map.height() + " squares · z=" + projectionLevel,
                viewMode.label(),
                editorMode ? selectedTool : "Token auf der Karte ziehen",
                renderedCells.size() + " cells, " + renderedEdges.size() + " edges · "
                        + resolvedOverlay.mode().label(),
                mapLoaded,
                mapLoaded ? "" : "No dungeon map geometry available.",
                topology(map.topology()),
                viewMode,
                resolvedOverlay,
                projectionLevel,
                editorMode,
                selectedTool,
                selection,
                dragPreview,
                paintPreview,
                renderedCells,
                renderedEdges,
                renderedLabels,
                renderedMarkers,
                graphNodes,
                graphLinks,
                editorMode ? null : runtimePartyToken);
    }

    private static RenderCell renderCell(
            DungeonAreaSnapshot area,
            DungeonCellRef cell,
            boolean selected,
            boolean preview,
            int deltaQ,
            int deltaR
    ) {
        return renderCell(area, cell, selected, preview, deltaQ, deltaR, 0);
    }

    private static RenderCell renderCell(
            DungeonAreaSnapshot area,
            DungeonCellRef cell,
            boolean selected,
            boolean preview,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        CellKind kind = area.kind() == DungeonAreaKind.CORRIDOR ? CellKind.CORRIDOR : CellKind.ROOM;
        return new RenderCell(
                cell.q() + deltaQ,
                cell.r() + deltaR,
                cell.level() + deltaLevel,
                area.label(),
                kind,
                area.id(),
                area.clusterId(),
                topologyRef(area.topologyRef()),
                selected,
                false,
                preview,
                false);
    }

    private static RenderCell renderFeatureCell(
            DungeonFeatureSnapshot feature,
            DungeonCellRef cell,
            @Nullable Selection selection
    ) {
        CellKind kind = feature.kind() == DungeonFeatureKind.TRANSITION ? CellKind.TRANSITION : CellKind.STAIR;
        return new RenderCell(
                cell.q(),
                cell.r(),
                cell.level(),
                feature.label(),
                kind,
                feature.id(),
                0L,
                topologyRef(feature.topologyRef()),
                selectedFeature(feature, selection),
                false,
                false,
                false);
    }

    private static void addPaintPreview(List<RenderCell> renderedCells, PaintPreview paintPreview) {
        int minQ = Math.min(paintPreview.startQ(), paintPreview.endQ());
        int maxQ = Math.max(paintPreview.startQ(), paintPreview.endQ());
        int minR = Math.min(paintPreview.startR(), paintPreview.endR());
        int maxR = Math.max(paintPreview.startR(), paintPreview.endR());
        for (int q = minQ; q <= maxQ; q++) {
            for (int r = minR; r <= maxR; r++) {
                renderedCells.add(new RenderCell(
                        q,
                        r,
                        paintPreview.level(),
                        paintPreview.deleteMode() ? "Delete preview" : "Paint preview",
                        CellKind.ROOM,
                        0L,
                        0L,
                        TopologyRef.empty(),
                        false,
                        false,
                        true,
                        paintPreview.deleteMode()));
            }
        }
    }

    private static void addClusterDragPreview(
            List<RenderCell> renderedCells,
            List<RenderLabel> renderedLabels,
            List<GraphNode> graphNodes,
            DungeonAreaSnapshot area,
            DragPreview dragPreview
    ) {
        List<RenderCell> previewCells = area.cells().stream()
                .map(cell -> renderCell(
                        area,
                        cell,
                        true,
                        true,
                        dragPreview.deltaQ(),
                        dragPreview.deltaR(),
                        dragPreview.deltaLevel()))
                .toList();
        renderedCells.addAll(previewCells);
        if (previewCells.isEmpty()) {
            return;
        }
        CellCenter center = centerOf(previewCells);
        String label = dragPreview.label().isBlank() ? area.label() : dragPreview.label();
        renderedLabels.add(new RenderLabel(
                label,
                center.x(),
                center.y(),
                previewCells.getFirst().z(),
                area.id(),
                area.clusterId(),
                topologyRef(area.topologyRef()),
                true));
        graphNodes.add(new GraphNode(area.id(), area.clusterId(), label, center.x(), center.y(), true));
    }

    private static void addHandleDragPreview(List<RenderMarker> renderedMarkers, @Nullable DragPreview dragPreview) {
        if (dragPreview == null || !dragPreview.active()
                || dragPreview.handleRef().kind() == DungeonEditorHandleKind.CLUSTER_LABEL) {
            return;
        }
        DungeonEditorHandleRef ref = dragPreview.handleRef();
        DungeonCellRef cell = ref.cell();
        DungeonCellRef movedCell = new DungeonCellRef(
                cell.q() + dragPreview.deltaQ(),
                cell.r() + dragPreview.deltaR(),
                cell.level() + dragPreview.deltaLevel());
        DungeonEditorHandleRef movedRef = new DungeonEditorHandleRef(
                ref.kind(),
                ref.topologyRef(),
                ref.ownerId(),
                ref.clusterId(),
                ref.corridorId(),
                ref.roomId(),
                ref.index(),
                movedCell,
                ref.direction());
        renderedMarkers.add(new RenderMarker(
                handleMarkerLabel(ref.kind()),
                movedCell.q() + 0.5,
                movedCell.r() + 0.5,
                movedCell.level(),
                handleMarkerKind(ref.kind()),
                true,
                movedRef));
    }

    private static RenderEdge renderEdge(DungeonBoundarySnapshot boundary) {
        DungeonEdgeRef edge = boundary.edge();
        boolean door = "door".equalsIgnoreCase(boundary.kind());
        return new RenderEdge(
                edge.from().q(),
                edge.from().r(),
                edge.to().q(),
                edge.to().r(),
                edge.from().level(),
                door ? EdgeKind.DOOR : EdgeKind.WALL,
                boundary.label(),
                boundary.id(),
                topologyRef(boundary.topologyRef()),
                false);
    }

    private static void addRepresentativeGeometry(
            List<RenderCell> cells,
            List<RenderEdge> edges,
            List<RenderLabel> labels,
            List<GraphNode> graphNodes,
            List<GraphLink> graphLinks
    ) {
        long roomId = 1_000L;
        long corridorId = 2_000L;
        addRoom(cells, labels, graphNodes, roomId, "Watch Post", 6, 4, 3, 2, 0, false);
        addRoom(cells, labels, graphNodes, roomId + 1, "Moon Crypt", 2, 8, 4, 3, -1, false);
        addCorridor(cells, corridorId, 4, 4, 2, false);
        addCorridor(cells, corridorId, 5, 4, 3, false);
        addCorridor(cells, corridorId + 1, 3, 6, 2, false);
        cells.add(new RenderCell(
                8, 5, 0, "Stair", CellKind.STAIR, 3_000L, 0L, new TopologyRef("STAIR", 3_000L),
                false, false, false, false));
        cells.add(new RenderCell(
                1, 3, 0, "Transition", CellKind.TRANSITION, 4_000L, 0L, new TopologyRef("TRANSITION", 4_000L),
                false, false, false, false));
        cells.add(new RenderCell(
                7, 5, 1, "Balcony", CellKind.ROOM, 5_000L, 5_000L, new TopologyRef("ROOM", 5_000L),
                false, true, false, false));
        edges.add(new RenderEdge(4, 4, 6, 4, 0, EdgeKind.DOOR, "Door", 10_000L, new TopologyRef("DOOR", 10_000L), false));
        edges.add(new RenderEdge(5, 6, 5, 8, 0, EdgeKind.DOOR, "Door", 10_001L, new TopologyRef("DOOR", 10_001L), false));
        edges.add(new RenderEdge(6, 4, 9, 4, 0, EdgeKind.WALL, "North wall", 10_002L, new TopologyRef("WALL", 10_002L), false));
        edges.add(new RenderEdge(2, 8, 6, 8, -1, EdgeKind.WALL, "Lower wall", 10_003L, new TopologyRef("WALL", 10_003L), false));
        linkNearbyNodes(graphNodes, graphLinks);
    }

    private static List<RenderMarker> representativeMarkers(String selectedTool) {
        return List.of(
                new RenderMarker("1", 3.0, 3.98, 0, MarkerKind.DOOR, false),
                new RenderMarker("2", 5.0, 5.50, 0, MarkerKind.DOOR, false),
                new RenderMarker("z", 8.5, 5.5, 0, MarkerKind.STAIR, "Treppe".equals(selectedTool)),
                new RenderMarker("->", 1.5, 3.5, 0, MarkerKind.TRANSITION, selectedTool != null && selectedTool.contains("bergang"))
        );
    }

    private static RenderMarker markerForFeature(
            DungeonFeatureSnapshot feature,
            CellCenter center,
            int level,
            boolean selected
    ) {
        MarkerKind kind = feature.kind() == DungeonFeatureKind.TRANSITION ? MarkerKind.TRANSITION : MarkerKind.STAIR;
        String label = feature.kind() == DungeonFeatureKind.TRANSITION ? "->" : "z";
        return new RenderMarker(label, center.x(), center.y(), level, kind, selected);
    }

    private static RenderMarker markerForHandle(DungeonEditorHandleSnapshot handle, @Nullable Selection selection) {
        DungeonEditorHandleRef ref = handle.ref();
        return new RenderMarker(
                handleMarkerLabel(ref.kind()),
                handle.cell().q() + 0.5,
                handle.cell().r() + 0.5,
                handle.cell().level(),
                handleMarkerKind(ref.kind()),
                selectedHandle(ref, selection),
                ref);
    }

    private static MarkerKind handleMarkerKind(DungeonEditorHandleKind kind) {
        return switch (kind) {
            case DOOR -> MarkerKind.DOOR;
            case STAIR_ANCHOR -> MarkerKind.STAIR;
            case CORRIDOR_WAYPOINT -> MarkerKind.WAYPOINT;
            case CLUSTER_LABEL -> MarkerKind.CLUSTER;
        };
    }

    private static String handleMarkerLabel(DungeonEditorHandleKind kind) {
        return switch (kind) {
            case DOOR -> "D";
            case STAIR_ANCHOR -> "z";
            case CORRIDOR_WAYPOINT -> "•";
            case CLUSTER_LABEL -> "";
        };
    }

    private static void addRoom(
            List<RenderCell> cells,
            List<RenderLabel> labels,
            List<GraphNode> graphNodes,
            long id,
            String label,
            int startQ,
            int startR,
            int width,
            int height,
            int z,
            boolean selected
    ) {
        for (int row = 0; row < height; row++) {
            for (int column = 0; column < width; column++) {
                cells.add(new RenderCell(
                        startQ + column,
                        startR + row,
                        z,
                        label,
                        CellKind.ROOM,
                        id,
                        id,
                        new TopologyRef("ROOM", id),
                        selected,
                        z != 0,
                        false,
                        false));
            }
        }
        double centerX = startQ + width / 2.0;
        double centerY = startR + height / 2.0;
        labels.add(new RenderLabel(label, centerX, centerY, z, id, id, new TopologyRef("ROOM", id), selected));
        graphNodes.add(new GraphNode(id, id, label, centerX, centerY, selected));
    }

    private static void addCorridor(List<RenderCell> cells, long id, int q, int startR, int length, boolean selected) {
        for (int offset = 0; offset < length; offset++) {
            cells.add(new RenderCell(
                    q,
                    startR + offset,
                    0,
                    "Corridor",
                    CellKind.CORRIDOR,
                    id,
                    0L,
                    new TopologyRef("CORRIDOR", id),
                    selected,
                    false,
                    false,
                    false));
        }
    }

    private static void linkNearbyNodes(List<GraphNode> nodes, List<GraphLink> links) {
        Map<Long, GraphNode> unique = new LinkedHashMap<>();
        for (GraphNode node : nodes) {
            unique.putIfAbsent(node.id(), node);
        }
        List<GraphNode> values = new ArrayList<>(unique.values());
        if (values.size() < 2) {
            return;
        }
        for (int index = 1; index < values.size(); index++) {
            links.add(new GraphLink(values.get(index - 1).id(), values.get(index).id(), false));
        }
    }

    private static boolean selectedArea(DungeonAreaSnapshot area, @Nullable Selection selection) {
        if (area == null || selection == null) {
            return false;
        }
        if (selection.clusterSelection()) {
            return area.kind() == DungeonAreaKind.ROOM && area.clusterId() == selection.clusterId();
        }
        return topologyRef(area.topologyRef()).equals(selection.topologyRef()) || area.id() == selection.areaId();
    }

    private static boolean selectedFeature(DungeonFeatureSnapshot feature, @Nullable Selection selection) {
        if (feature == null || selection == null) {
            return false;
        }
        return topologyRef(feature.topologyRef()).equals(selection.topologyRef());
    }

    private static boolean selectedHandle(DungeonEditorHandleRef ref, @Nullable Selection selection) {
        if (ref == null || selection == null || selection.handleRef() == null) {
            return false;
        }
        DungeonEditorHandleRef selected = selection.handleRef();
        return sameStableHandle(ref, selected);
    }

    private static boolean draggedClusterArea(
            DungeonAreaSnapshot area,
            @Nullable Selection selection,
            DragPreview dragPreview
    ) {
        if (area == null || !dragPreview.active()
                || dragPreview.handleRef().kind() != DungeonEditorHandleKind.CLUSTER_LABEL) {
            return false;
        }
        long selectedClusterId = selection == null ? dragPreview.clusterId() : selection.clusterId();
        return selectedClusterId > 0L
                && area.kind() == DungeonAreaKind.ROOM
                && area.clusterId() == selectedClusterId;
    }

    private static boolean draggedHandle(DungeonEditorHandleRef ref, @Nullable DragPreview dragPreview) {
        if (ref == null || dragPreview == null || !dragPreview.active()
                || dragPreview.handleRef().kind() == DungeonEditorHandleKind.CLUSTER_LABEL) {
            return false;
        }
        return sameStableHandle(ref, dragPreview.handleRef());
    }

    private static boolean sameStableHandle(DungeonEditorHandleRef left, DungeonEditorHandleRef right) {
        return left.kind() == right.kind()
                && left.topologyRef().equals(right.topologyRef())
                && left.ownerId() == right.ownerId()
                && left.clusterId() == right.clusterId()
                && left.corridorId() == right.corridorId()
                && left.roomId() == right.roomId()
                && left.index() == right.index();
    }

    private static CellCenter centerOf(List<RenderCell> cells) {
        double x = 0.0;
        double y = 0.0;
        for (RenderCell cell : cells) {
            x += cell.q() + 0.5;
            y += cell.r() + 0.5;
        }
        int count = Math.max(1, cells.size());
        return new CellCenter(x / count, y / count);
    }

    private static RenderTopology topology(DungeonTopologyKind topology) {
        return topology == DungeonTopologyKind.HEX ? RenderTopology.HEX : RenderTopology.SQUARE;
    }

    private static TopologyRef topologyRef(DungeonTopologyElementRef ref) {
        if (ref == null) {
            return TopologyRef.empty();
        }
        return new TopologyRef(ref.kind().name(), ref.id());
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
            CellKind kind,
            long ownerId,
            long clusterId,
            TopologyRef topologyRef,
            boolean selected,
            boolean overlay,
            boolean preview,
            boolean destructivePreview
    ) {

        public RenderCell {
            label = label == null ? "" : label;
            kind = kind == null ? CellKind.ROOM : kind;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public record RenderEdge(
            double startQ,
            double startR,
            double endQ,
            double endR,
            int z,
            EdgeKind kind,
            String label,
            long ownerId,
            TopologyRef topologyRef,
            boolean selected
    ) {

        public RenderEdge {
            kind = kind == null ? EdgeKind.WALL : kind;
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public record RenderLabel(
            String label,
            double q,
            double r,
            int z,
            long ownerId,
            long clusterId,
            TopologyRef topologyRef,
            boolean selected
    ) {

        public RenderLabel {
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public record RenderMarker(
            String label,
            double q,
            double r,
            int z,
            MarkerKind kind,
            boolean selected,
            DungeonEditorHandleRef handleRef
    ) {

        public RenderMarker(String label, double q, double r, int z, MarkerKind kind, boolean selected) {
            this(label, q, r, z, kind, selected, emptyHandleRef(0L, 0L));
        }

        public RenderMarker {
            label = label == null ? "" : label;
            kind = kind == null ? MarkerKind.DOOR : kind;
            handleRef = handleRef == null ? emptyHandleRef(0L, 0L) : handleRef;
        }

        public String handleKind() {
            return handleRef.kind().name();
        }

        public long handleOwnerId() {
            return handleRef.ownerId();
        }

        public long handleClusterId() {
            return handleRef.clusterId();
        }

        public long handleCorridorId() {
            return handleRef.corridorId();
        }

        public long handleRoomId() {
            return handleRef.roomId();
        }

        public int handleIndex() {
            return handleRef.index();
        }

        public String handleDirection() {
            return handleRef.direction();
        }

        public String handleTopologyRefKind() {
            return handleRef.topologyRef().kind().name();
        }

        public long handleTopologyRefId() {
            return handleRef.topologyRef().id();
        }

        public int handleQ() {
            return handleRef.cell().q();
        }

        public int handleR() {
            return handleRef.cell().r();
        }

        public int handleLevel() {
            return handleRef.cell().level();
        }
    }

    public record GraphNode(long id, long clusterId, String label, double q, double r, boolean selected) {

        public GraphNode {
            label = label == null || label.isBlank() ? "Room" : label;
        }
    }

    public record GraphLink(long fromId, long toId, boolean selected) {
    }

    public record PartyToken(double q, double r, int z, Heading heading, boolean visible) {

        public PartyToken {
            heading = heading == null ? Heading.SOUTH : heading;
        }
    }

    public record Selection(
            long areaId,
            long clusterId,
            String label,
            TopologyRef topologyRef,
            boolean clusterSelection,
            DungeonEditorHandleRef handleRef
    ) {

        public Selection(long areaId, long clusterId, String label) {
            this(areaId, clusterId, label, new TopologyRef("ROOM", areaId), false);
        }

        public Selection(long areaId, long clusterId, String label, TopologyRef topologyRef) {
            this(areaId, clusterId, label, topologyRef, false);
        }

        public Selection(
                long areaId,
                long clusterId,
                String label,
                TopologyRef topologyRef,
                boolean clusterSelection
        ) {
            this(areaId, clusterId, label, topologyRef, clusterSelection, emptyHandleRef(areaId, clusterId));
        }

        public Selection {
            areaId = Math.max(0L, areaId);
            clusterId = Math.max(0L, clusterId);
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            handleRef = handleRef == null ? emptyHandleRef(areaId, clusterId) : handleRef;
        }
    }

    public record TopologyRef(String kind, long id) {

        public TopologyRef {
            kind = kind == null || kind.isBlank() ? "EMPTY" : kind.trim();
            id = Math.max(0L, id);
        }

        public static TopologyRef empty() {
            return new TopologyRef("EMPTY", 0L);
        }

        public DungeonTopologyElementRef toPublished() {
            return new DungeonTopologyElementRef(
                    src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(kind),
                    id);
        }
    }

    public record DragPreview(
            long clusterId,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            DungeonEditorHandleRef handleRef,
            String label
    ) {

        public DragPreview(long clusterId, int deltaQ, int deltaR) {
            this(clusterId, deltaQ, deltaR, 0);
        }

        public DragPreview(long clusterId, int deltaQ, int deltaR, int deltaLevel) {
            this(clusterId, deltaQ, deltaR, deltaLevel, emptyHandleRef(0L, clusterId), "");
        }

        public DragPreview {
            clusterId = Math.max(0L, clusterId);
            handleRef = handleRef == null ? emptyHandleRef(0L, clusterId) : handleRef;
            label = label == null ? "" : label;
        }

        public boolean active() {
            return (clusterId > 0L || handleRef.ownerId() > 0L)
                    && (deltaQ != 0 || deltaR != 0 || deltaLevel != 0);
        }
    }

    public record PaintPreview(int startQ, int startR, int endQ, int endR, int level, boolean deleteMode) {

        public boolean active() {
            return true;
        }
    }

    private static DungeonEditorHandleRef emptyHandleRef(long ownerId, long clusterId) {
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.CLUSTER_LABEL,
                DungeonTopologyElementRef.empty(),
                Math.max(0L, ownerId),
                Math.max(0L, clusterId),
                0L,
                Math.max(0L, ownerId),
                0,
                new DungeonCellRef(0, 0, 0),
                "");
    }

    private record CellCenter(double x, double y) {
    }
}
