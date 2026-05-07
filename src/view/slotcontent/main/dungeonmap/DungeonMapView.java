package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.ToDoubleFunction;
import java.util.function.ToIntFunction;
import java.util.function.ToLongFunction;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorHandleRef;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;
import src.domain.travel.published.TravelDungeonMapProjectionSnapshot;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelOverlaySettings;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasView;
import src.view.slotcontent.primitives.mapcanvas.MapRenderScene;

public class DungeonMapView extends MapCanvasView {

    public void bind(DungeonMapContentModel presentationModel) {
        if (presentationModel == null) {
            return;
        }
        renderSceneProperty().unbind();
        renderSceneProperty().bind(presentationModel.renderSceneProperty());
    }
}

record DungeonMapRenderState(
        String title,
        boolean projectionAvailable,
        int width,
        int height,
        DungeonMapRenderState.Topology topology,
        DungeonMapRenderState.ViewMode viewMode,
        DungeonMapRenderState.LevelOverlaySettings overlaySettings,
        int projectionLevel,
        boolean editorMode,
        String selectedTool,
        String emptyMessage,
        List<DungeonMapRenderState.Cell> cells,
        List<DungeonMapRenderState.Edge> edges,
        List<DungeonMapRenderState.Label> labels,
        List<DungeonMapRenderState.Marker> markers,
        List<DungeonMapRenderState.GraphNode> graphNodes,
        List<DungeonMapRenderState.GraphLink> graphLinks,
        DungeonMapRenderState.PartyToken partyToken
) {

    static final String SELECT_TOOL_LABEL = "Auswahl";
    private static final String EMPTY_KIND = "EMPTY";

    DungeonMapRenderState {
        title = normalizeTitle(title);
        width = Math.max(0, width);
        height = Math.max(0, height);
        topology = topology == null ? Topology.SQUARE : topology;
        viewMode = viewMode == null ? ViewMode.GRID : viewMode;
        overlaySettings = overlaySettings == null ? LevelOverlaySettings.defaults() : overlaySettings;
        selectedTool = normalizeTool(selectedTool);
        emptyMessage = normalizeEmptyMessage(emptyMessage, projectionAvailable);
        cells = immutableList(cells);
        edges = immutableList(edges);
        labels = immutableList(labels);
        markers = immutableList(markers);
        graphNodes = immutableList(graphNodes);
        graphLinks = immutableList(graphLinks);
    }

    String subtitle() {
        if (!projectionAvailable) {
            return "";
        }
        return width + " x " + height + " grid · z=" + projectionLevel;
    }

    String modeLabel() {
        return viewMode.label();
    }

    boolean isGraphView() {
        return viewMode == ViewMode.GRAPH;
    }

    MapRenderScene.ViewMode sceneViewMode() {
        return isGraphView() ? MapRenderScene.ViewMode.GRAPH : MapRenderScene.ViewMode.GRID;
    }

    String statusLabel() {
        return editorMode ? selectedTool : "Token auf der Karte ziehen";
    }

    String summaryLabel() {
        if (!projectionAvailable) {
            return "";
        }
        return cells.size() + " cells, " + edges.size() + " edges · " + overlaySettings.mode().label();
    }

    boolean mapLoaded() {
        return !(cells.isEmpty()
                && edges.isEmpty()
                && labels.isEmpty()
                && markers.isEmpty()
                && graphNodes.isEmpty());
    }

    String overlayMessage() {
        return mapLoaded() ? "" : emptyMessage;
    }

    DungeonMapRenderState withViewMode(ViewMode nextViewMode) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                nextViewMode == null ? ViewMode.GRID : nextViewMode,
                overlaySettings,
                projectionLevel,
                editorMode,
                selectedTool,
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    DungeonMapRenderState withOverlaySettings(LevelOverlaySettings nextOverlaySettings) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                viewMode,
                nextOverlaySettings == null ? LevelOverlaySettings.off() : nextOverlaySettings,
                projectionLevel,
                editorMode,
                selectedTool,
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    DungeonMapRenderState withProjectionLevel(int nextProjectionLevel) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                viewMode,
                overlaySettings,
                nextProjectionLevel,
                editorMode,
                selectedTool,
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    DungeonMapRenderState withSelectedTool(String nextSelectedTool) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                viewMode,
                overlaySettings,
                projectionLevel,
                editorMode,
                normalizeTool(nextSelectedTool),
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    static DungeonMapRenderState empty(String title, boolean editorMode) {
        return new DungeonMapRenderState(
                title,
                false,
                0,
                0,
                Topology.SQUARE,
                ViewMode.GRID,
                LevelOverlaySettings.off(),
                0,
                editorMode,
                SELECT_TOOL_LABEL,
                "No dungeon map loaded.",
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null);
    }

    enum Topology {
        SQUARE,
        HEX;

        static Topology fromEditor(DungeonEditorMapProjectionSnapshot.TopologyKind topologyKind) {
            return topologyKind == DungeonEditorMapProjectionSnapshot.TopologyKind.HEX ? HEX : SQUARE;
        }

        static Topology fromTravel(TravelDungeonMapProjectionSnapshot.TopologyKind topologyKind) {
            return topologyKind == TravelDungeonMapProjectionSnapshot.TopologyKind.HEX ? HEX : SQUARE;
        }
    }

    enum ViewMode {
        GRID("Grid"),
        GRAPH("Graph");

        private final String label;

        ViewMode(String label) {
            this.label = label;
        }

        String label() {
            return label;
        }

        static ViewMode grid() {
            return GRID;
        }

        static ViewMode fromEditor(DungeonEditorViewMode viewMode) {
            return viewMode == DungeonEditorViewMode.GRAPH ? GRAPH : GRID;
        }
    }

    enum OverlayMode {
        OFF("Overlay: Aus"),
        NEARBY("Overlay: Nachbarn"),
        SELECTED("Overlay: Auswahl");

        private final String label;

        OverlayMode(String label) {
            this.label = label;
        }

        String label() {
            return label;
        }

        static OverlayMode fromKey(String modeKey) {
            return switch (upper(modeKey)) {
                case "NEARBY" -> NEARBY;
                case "SELECTED" -> SELECTED;
                default -> OFF;
            };
        }
    }

    enum CellKind {
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION;

        static CellKind fromKey(String kindKey) {
            return switch (upper(kindKey)) {
                case "CORRIDOR" -> CORRIDOR;
                case "STAIR" -> STAIR;
                case "TRANSITION" -> TRANSITION;
                default -> ROOM;
            };
        }
    }

    enum EdgeKind {
        WALL,
        DOOR;

        static EdgeKind fromKey(String kindKey) {
            return "DOOR".equalsIgnoreCase(kindKey) ? DOOR : WALL;
        }
    }

    enum MarkerKind {
        DOOR,
        STAIR,
        TRANSITION,
        WAYPOINT,
        CLUSTER;

        static MarkerKind fromKey(String kindKey) {
            return switch (upper(kindKey)) {
                case "STAIR" -> STAIR;
                case "TRANSITION" -> TRANSITION;
                case "WAYPOINT" -> WAYPOINT;
                case "CLUSTER" -> CLUSTER;
                default -> DOOR;
            };
        }
    }

    enum Heading {
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

        double dx() {
            return dx;
        }

        double dy() {
            return dy;
        }

        static Heading fromName(String headingName) {
            return switch (upper(headingName)) {
                case "NORTH" -> NORTH;
                case "EAST" -> EAST;
                case "WEST" -> WEST;
                default -> SOUTH;
            };
        }
    }

    record LevelOverlaySettings(
            DungeonMapRenderState.OverlayMode mode,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {

        private static final int DEFAULT_LEVEL_RANGE = 2;
        private static final int MAX_LEVEL_RANGE = 6;
        private static final double DEFAULT_OPACITY = 0.35;

        LevelOverlaySettings {
            mode = mode == null ? OverlayMode.OFF : mode;
            levelRange = Math.max(1, Math.min(MAX_LEVEL_RANGE, levelRange));
            opacity = Math.max(0.05, Math.min(0.95, opacity));
            selectedLevels = selectedLevels == null
                    ? List.of()
                    : selectedLevels.stream()
                            .filter(Objects::nonNull)
                            .distinct()
                            .sorted()
                            .toList();
        }

        @Override
        public List<Integer> selectedLevels() {
            return immutableList(selectedLevels);
        }

        boolean selectsLevel(int level) {
            return selectedLevels().contains(level);
        }

        static LevelOverlaySettings defaults() {
            return new LevelOverlaySettings(OverlayMode.NEARBY, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
        }

        static LevelOverlaySettings off() {
            return new LevelOverlaySettings(OverlayMode.OFF, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
        }
    }

    record TopologyRef(String kind, long id) {

        TopologyRef {
            kind = kind == null || kind.isBlank() ? EMPTY_KIND : kind.trim();
            id = Math.max(0L, id);
        }

        boolean isEmpty() {
            return id <= 0L || EMPTY_KIND.equals(kind);
        }

        static TopologyRef empty() {
            return new TopologyRef(EMPTY_KIND, 0L);
        }
    }

    record MarkerHandle(
            String kind,
            DungeonMapRenderState.TopologyRef topologyRef,
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

        MarkerHandle {
            kind = kind == null || kind.isBlank() ? EMPTY_KIND : kind.trim();
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            index = Math.max(0, index);
            direction = direction == null ? "" : direction.trim();
        }
    }

    record Cell(
            int q,
            int r,
            int z,
            String label,
            DungeonMapRenderState.CellKind kind,
            long ownerId,
            long clusterId,
            DungeonMapRenderState.TopologyRef topologyRef,
            boolean selected,
            boolean overlay,
            boolean preview,
            boolean destructivePreview
    ) {

        Cell {
            label = label == null ? "" : label;
            kind = kind == null ? CellKind.ROOM : kind;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    record Edge(
            double startQ,
            double startR,
            double endQ,
            double endR,
            int z,
            DungeonMapRenderState.EdgeKind kind,
            String label,
            long ownerId,
            DungeonMapRenderState.TopologyRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        Edge {
            kind = kind == null ? EdgeKind.WALL : kind;
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }

        boolean isDoor() {
            return kind == EdgeKind.DOOR;
        }
    }

    record Label(
            String label,
            double q,
            double r,
            int z,
            long ownerId,
            long clusterId,
            DungeonMapRenderState.TopologyRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        Label {
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    record Marker(
            String label,
            double q,
            double r,
            int z,
            DungeonMapRenderState.MarkerKind kind,
            boolean selected,
            DungeonMapRenderState.MarkerHandle handle,
            boolean preview
    ) {

        Marker {
            label = label == null ? "" : label;
            kind = kind == null ? MarkerKind.DOOR : kind;
            handle = handle == null
                    ? new MarkerHandle(EMPTY_KIND, TopologyRef.empty(), 0L, 0L, 0L, 0L, 0, 0, 0, 0, "")
                    : handle;
        }

        boolean isDoorMarker() {
            return kind == MarkerKind.DOOR;
        }
    }

    record GraphNode(long id, long clusterId, String label, double q, double r, boolean selected) {

        GraphNode {
            label = label == null || label.isBlank() ? "Room" : label;
        }
    }

    record GraphLink(long fromId, long toId, boolean selected) {
    }

    record PartyToken(double q, double r, int z, DungeonMapRenderState.Heading heading, boolean visible) {

        PartyToken {
            heading = heading == null ? Heading.SOUTH : heading;
        }
    }

    private static String normalizeTitle(String title) {
        return title == null || title.isBlank() ? "Dungeon Map" : title.trim();
    }

    private static String normalizeTool(String selectedTool) {
        return selectedTool == null || selectedTool.isBlank() ? SELECT_TOOL_LABEL : selectedTool;
    }

    private static String normalizeEmptyMessage(String emptyMessage, boolean projectionAvailable) {
        if (emptyMessage != null && !emptyMessage.isBlank()) {
            return emptyMessage;
        }
        return projectionAvailable ? "No dungeon map geometry available." : "No dungeon map loaded.";
    }

    private static <T> List<T> immutableList(@Nullable List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static String upper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}

final class DungeonMapSnapshotMapper {

    private static final Map<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();

    private DungeonMapSnapshotMapper() {
    }

    static DungeonMapRenderState mapEditor(String placeholderTitle, DungeonEditorSnapshot snapshot) {
        DungeonEditorSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorSnapshot.empty("")
                : snapshot;
        DungeonMapRenderState baseState = mapProjection(
                placeholderTitle,
                safeSnapshot.mapProjection(),
                true,
                DungeonMapEditorProjectionAccess.ACCESS);
        return baseState.withViewMode(DungeonMapRenderState.ViewMode.fromEditor(safeSnapshot.viewMode()))
                .withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(toolLabel(safeSnapshot.selectedTool()));
    }

    static DungeonMapRenderState mapTravel(String placeholderTitle, TravelDungeonSnapshot snapshot) {
        TravelDungeonSnapshot safeSnapshot = snapshot == null
                ? TravelDungeonSnapshot.empty()
                : snapshot;
        DungeonMapRenderState baseState = mapProjection(
                placeholderTitle,
                safeSnapshot.mapProjection(),
                false,
                DungeonMapTravelProjectionAccess.ACCESS);
        return baseState.withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(DungeonMapRenderState.SELECT_TOOL_LABEL);
    }

    private static <P, C, E, L, M, N, G, T> DungeonMapRenderState mapProjection(
            String placeholderTitle,
            @Nullable P projection,
            boolean editorMode,
            DungeonMapProjectionElements.ProjectionAccess<P, C, E, L, M, N, G, T> access
    ) {
        if (projection == null) {
            return DungeonMapRenderState.empty(placeholderTitle, editorMode);
        }
        return new DungeonMapRenderState(
                access.mapName().apply(projection),
                true,
                Math.max(1, access.width().applyAsInt(projection)),
                Math.max(1, access.height().applyAsInt(projection)),
                access.topology().apply(projection),
                DungeonMapRenderState.ViewMode.grid(),
                DungeonMapRenderState.LevelOverlaySettings.off(),
                0,
                editorMode,
                DungeonMapRenderState.SELECT_TOOL_LABEL,
                "No dungeon map geometry available.",
                DungeonMapProjectionElements.mapCells(access.cells().apply(projection), access.cellReader()),
                DungeonMapProjectionElements.mapEdges(access.edges().apply(projection), access.edgeReader()),
                DungeonMapProjectionElements.mapLabels(access.labels().apply(projection), access.labelReader()),
                DungeonMapProjectionElements.mapMarkers(access.markers().apply(projection), access.markerReader()),
                DungeonMapProjectionElements.mapGraphNodes(access.graphNodes().apply(projection), access.graphNodeReader()),
                DungeonMapProjectionElements.mapGraphLinks(access.graphLinks().apply(projection), access.graphLinkReader()),
                DungeonMapProjectionElements.mapPartyToken(
                        access.partyToken().apply(projection),
                        access.partyTokenReader()));
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

    private static String toolLabel(DungeonEditorTool selectedTool) {
        return TOOL_LABELS.getOrDefault(selectedTool, DungeonMapRenderState.SELECT_TOOL_LABEL);
    }

    private static Map<DungeonEditorTool, String> createToolLabels() {
        Map<DungeonEditorTool, String> labels = new EnumMap<>(DungeonEditorTool.class);
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

final class DungeonMapProjectionElements {

    private DungeonMapProjectionElements() {
    }

    static <T> List<DungeonMapRenderState.Cell> mapCells(
            List<T> cells,
            DungeonMapProjectionElements.CellReader<T> reader
    ) {
        List<DungeonMapRenderState.Cell> mapped = new ArrayList<>(cells.size());
        for (T cell : cells) {
            mapped.add(new DungeonMapRenderState.Cell(
                    reader.q().applyAsInt(cell),
                    reader.r().applyAsInt(cell),
                    reader.level().applyAsInt(cell),
                    reader.label().apply(cell),
                    DungeonMapRenderState.CellKind.fromKey(reader.kindKey().apply(cell)),
                    reader.ownerId().applyAsLong(cell),
                    reader.clusterId().applyAsLong(cell),
                    new DungeonMapRenderState.TopologyRef(
                            reader.topologyKind().apply(cell),
                            reader.topologyId().applyAsLong(cell)),
                    reader.selected().test(cell),
                    reader.overlay().test(cell),
                    reader.preview().test(cell),
                    reader.destructivePreview().test(cell)));
        }
        return List.copyOf(mapped);
    }

    static <T> List<DungeonMapRenderState.Edge> mapEdges(
            List<T> edges,
            DungeonMapProjectionElements.EdgeReader<T> reader
    ) {
        List<DungeonMapRenderState.Edge> mapped = new ArrayList<>(edges.size());
        for (T edge : edges) {
            mapped.add(new DungeonMapRenderState.Edge(
                    reader.startQ().applyAsDouble(edge),
                    reader.startR().applyAsDouble(edge),
                    reader.endQ().applyAsDouble(edge),
                    reader.endR().applyAsDouble(edge),
                    reader.level().applyAsInt(edge),
                    DungeonMapRenderState.EdgeKind.fromKey(reader.kindKey().apply(edge)),
                    reader.label().apply(edge),
                    reader.ownerId().applyAsLong(edge),
                    new DungeonMapRenderState.TopologyRef(
                            reader.topologyKind().apply(edge),
                            reader.topologyId().applyAsLong(edge)),
                    reader.selected().test(edge),
                    reader.preview().test(edge)));
        }
        return List.copyOf(mapped);
    }

    static <T> List<DungeonMapRenderState.Label> mapLabels(
            List<T> labels,
            DungeonMapProjectionElements.LabelReader<T> reader
    ) {
        List<DungeonMapRenderState.Label> mapped = new ArrayList<>(labels.size());
        for (T label : labels) {
            mapped.add(new DungeonMapRenderState.Label(
                    reader.label().apply(label),
                    reader.q().applyAsDouble(label),
                    reader.r().applyAsDouble(label),
                    reader.level().applyAsInt(label),
                    reader.ownerId().applyAsLong(label),
                    reader.clusterId().applyAsLong(label),
                    new DungeonMapRenderState.TopologyRef(
                            reader.topologyKind().apply(label),
                            reader.topologyId().applyAsLong(label)),
                    reader.selected().test(label),
                    reader.preview().test(label)));
        }
        return List.copyOf(mapped);
    }

    static <T, H> List<DungeonMapRenderState.Marker> mapMarkers(
            List<T> markers,
            DungeonMapProjectionElements.MarkerReader<T, H> reader
    ) {
        List<DungeonMapRenderState.Marker> mapped = new ArrayList<>(markers.size());
        for (T marker : markers) {
            H handle = reader.handle().apply(marker);
            mapped.add(new DungeonMapRenderState.Marker(
                    reader.label().apply(marker),
                    reader.q().applyAsDouble(marker),
                    reader.r().applyAsDouble(marker),
                    reader.level().applyAsInt(marker),
                    DungeonMapRenderState.MarkerKind.fromKey(reader.kindKey().apply(marker)),
                    reader.selected().test(marker),
                    new DungeonMapRenderState.MarkerHandle(
                            reader.handleReader().kind().apply(handle),
                            new DungeonMapRenderState.TopologyRef(
                                    reader.handleReader().topologyKind().apply(handle),
                                    reader.handleReader().topologyId().applyAsLong(handle)),
                            reader.handleReader().ownerId().applyAsLong(handle),
                            reader.handleReader().clusterId().applyAsLong(handle),
                            reader.handleReader().corridorId().applyAsLong(handle),
                            reader.handleReader().roomId().applyAsLong(handle),
                            reader.handleReader().index().applyAsInt(handle),
                            reader.handleReader().q().applyAsInt(handle),
                            reader.handleReader().r().applyAsInt(handle),
                            reader.handleReader().level().applyAsInt(handle),
                            reader.handleReader().direction().apply(handle)),
                    reader.preview().test(marker)));
        }
        return List.copyOf(mapped);
    }

    static <T> List<DungeonMapRenderState.GraphNode> mapGraphNodes(
            List<T> nodes,
            DungeonMapProjectionElements.GraphNodeReader<T> reader
    ) {
        List<DungeonMapRenderState.GraphNode> mapped = new ArrayList<>(nodes.size());
        for (T node : nodes) {
            mapped.add(new DungeonMapRenderState.GraphNode(
                    reader.id().applyAsLong(node),
                    reader.clusterId().applyAsLong(node),
                    reader.label().apply(node),
                    reader.q().applyAsDouble(node),
                    reader.r().applyAsDouble(node),
                    reader.selected().test(node)));
        }
        return List.copyOf(mapped);
    }

    static <T> List<DungeonMapRenderState.GraphLink> mapGraphLinks(
            List<T> links,
            DungeonMapProjectionElements.GraphLinkReader<T> reader
    ) {
        List<DungeonMapRenderState.GraphLink> mapped = new ArrayList<>(links.size());
        for (T link : links) {
            mapped.add(new DungeonMapRenderState.GraphLink(
                    reader.fromId().applyAsLong(link),
                    reader.toId().applyAsLong(link),
                    reader.selected().test(link)));
        }
        return List.copyOf(mapped);
    }

    static <T> DungeonMapRenderState.PartyToken mapPartyToken(
            @Nullable T token,
            DungeonMapProjectionElements.PartyTokenReader<T> reader
    ) {
        if (token == null || reader == null) {
            return null;
        }
        return new DungeonMapRenderState.PartyToken(
                reader.q().applyAsDouble(token),
                reader.r().applyAsDouble(token),
                reader.level().applyAsInt(token),
                DungeonMapRenderState.Heading.fromName(reader.headingName().apply(token)),
                reader.visible().test(token));
    }

    record ProjectionAccess<P, C, E, L, M, N, G, T>(
            Function<P, String> mapName,
            ToIntFunction<P> width,
            ToIntFunction<P> height,
            Function<P, DungeonMapRenderState.Topology> topology,
            Function<P, List<C>> cells,
            DungeonMapProjectionElements.CellReader<C> cellReader,
            Function<P, List<E>> edges,
            DungeonMapProjectionElements.EdgeReader<E> edgeReader,
            Function<P, List<L>> labels,
            DungeonMapProjectionElements.LabelReader<L> labelReader,
            Function<P, List<M>> markers,
            DungeonMapProjectionElements.MarkerReader<M, ?> markerReader,
            Function<P, List<N>> graphNodes,
            DungeonMapProjectionElements.GraphNodeReader<N> graphNodeReader,
            Function<P, List<G>> graphLinks,
            DungeonMapProjectionElements.GraphLinkReader<G> graphLinkReader,
            Function<P, T> partyToken,
            DungeonMapProjectionElements.PartyTokenReader<T> partyTokenReader
    ) {
    }

    record CellReader<T>(
            ToIntFunction<T> q,
            ToIntFunction<T> r,
            ToIntFunction<T> level,
            Function<T, String> label,
            Function<T, String> kindKey,
            ToLongFunction<T> ownerId,
            ToLongFunction<T> clusterId,
            Function<T, String> topologyKind,
            ToLongFunction<T> topologyId,
            Predicate<T> selected,
            Predicate<T> overlay,
            Predicate<T> preview,
            Predicate<T> destructivePreview
    ) {
    }

    record EdgeReader<T>(
            ToDoubleFunction<T> startQ,
            ToDoubleFunction<T> startR,
            ToDoubleFunction<T> endQ,
            ToDoubleFunction<T> endR,
            ToIntFunction<T> level,
            Function<T, String> kindKey,
            Function<T, String> label,
            ToLongFunction<T> ownerId,
            Function<T, String> topologyKind,
            ToLongFunction<T> topologyId,
            Predicate<T> selected,
            Predicate<T> preview
    ) {
    }

    record LabelReader<T>(
            Function<T, String> label,
            ToDoubleFunction<T> q,
            ToDoubleFunction<T> r,
            ToIntFunction<T> level,
            ToLongFunction<T> ownerId,
            ToLongFunction<T> clusterId,
            Function<T, String> topologyKind,
            ToLongFunction<T> topologyId,
            Predicate<T> selected,
            Predicate<T> preview
    ) {
    }

    record MarkerReader<T, H>(
            Function<T, String> label,
            ToDoubleFunction<T> q,
            ToDoubleFunction<T> r,
            ToIntFunction<T> level,
            Function<T, String> kindKey,
            Predicate<T> selected,
            Function<T, H> handle,
            DungeonMapProjectionElements.MarkerHandleReader<H> handleReader,
            Predicate<T> preview
    ) {
    }

    record MarkerHandleReader<T>(
            Function<T, String> kind,
            Function<T, String> topologyKind,
            ToLongFunction<T> topologyId,
            ToLongFunction<T> ownerId,
            ToLongFunction<T> clusterId,
            ToLongFunction<T> corridorId,
            ToLongFunction<T> roomId,
            ToIntFunction<T> index,
            ToIntFunction<T> q,
            ToIntFunction<T> r,
            ToIntFunction<T> level,
            Function<T, String> direction
    ) {
    }

    record GraphNodeReader<T>(
            ToLongFunction<T> id,
            ToLongFunction<T> clusterId,
            Function<T, String> label,
            ToDoubleFunction<T> q,
            ToDoubleFunction<T> r,
            Predicate<T> selected
    ) {
    }

    record GraphLinkReader<T>(
            ToLongFunction<T> fromId,
            ToLongFunction<T> toId,
            Predicate<T> selected
    ) {
    }

    record PartyTokenReader<T>(
            ToDoubleFunction<T> q,
            ToDoubleFunction<T> r,
            ToIntFunction<T> level,
            Function<T, String> headingName,
            Predicate<T> visible
    ) {
    }
}

final class DungeonMapEditorProjectionAccess {

    static final DungeonMapProjectionElements.ProjectionAccess<
            DungeonEditorMapProjectionSnapshot,
            DungeonEditorMapProjectionSnapshot.CellProjection,
            DungeonEditorMapProjectionSnapshot.EdgeProjection,
            DungeonEditorMapProjectionSnapshot.LabelProjection,
            DungeonEditorMapProjectionSnapshot.MarkerProjection,
            DungeonEditorMapProjectionSnapshot.GraphNodeProjection,
            DungeonEditorMapProjectionSnapshot.GraphLinkProjection,
            DungeonEditorMapProjectionSnapshot.PartyTokenProjection> ACCESS =
            new DungeonMapProjectionElements.ProjectionAccess<>(
                    DungeonEditorMapProjectionSnapshot::mapName,
                    DungeonEditorMapProjectionSnapshot::width,
                    DungeonEditorMapProjectionSnapshot::height,
                    projection -> DungeonMapRenderState.Topology.fromEditor(projection.topology()),
                    DungeonEditorMapProjectionSnapshot::cells,
                    new DungeonMapProjectionElements.CellReader<>(
                            DungeonEditorMapProjectionSnapshot.CellProjection::q,
                            DungeonEditorMapProjectionSnapshot.CellProjection::r,
                            DungeonEditorMapProjectionSnapshot.CellProjection::level,
                            DungeonEditorMapProjectionSnapshot.CellProjection::label,
                            cell -> cell.kind().name(),
                            DungeonEditorMapProjectionSnapshot.CellProjection::ownerId,
                            DungeonEditorMapProjectionSnapshot.CellProjection::clusterId,
                            cell -> cell.topologyRef().kind(),
                            cell -> cell.topologyRef().id(),
                            DungeonEditorMapProjectionSnapshot.CellProjection::selected,
                            DungeonEditorMapProjectionSnapshot.CellProjection::overlay,
                            DungeonEditorMapProjectionSnapshot.CellProjection::preview,
                            DungeonEditorMapProjectionSnapshot.CellProjection::destructivePreview),
                    DungeonEditorMapProjectionSnapshot::edges,
                    new DungeonMapProjectionElements.EdgeReader<>(
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::startQ,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::startR,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::endQ,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::endR,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::level,
                            edge -> edge.kind().name(),
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::label,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::ownerId,
                            edge -> edge.topologyRef().kind(),
                            edge -> edge.topologyRef().id(),
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::selected,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::preview),
                    DungeonEditorMapProjectionSnapshot::labels,
                    new DungeonMapProjectionElements.LabelReader<>(
                            DungeonEditorMapProjectionSnapshot.LabelProjection::label,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::q,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::r,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::level,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::ownerId,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::clusterId,
                            label -> label.topologyRef().kind(),
                            label -> label.topologyRef().id(),
                            DungeonEditorMapProjectionSnapshot.LabelProjection::selected,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::preview),
                    DungeonEditorMapProjectionSnapshot::markers,
                    new DungeonMapProjectionElements.MarkerReader<>(
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::label,
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::q,
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::r,
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::level,
                            marker -> marker.kind().name(),
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::selected,
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::handleRef,
                            new DungeonMapProjectionElements.MarkerHandleReader<>(
                                    DungeonEditorHandleRef::kind,
                                    handle -> handle.topologyRef().kind(),
                                    handle -> handle.topologyRef().id(),
                                    DungeonEditorHandleRef::ownerId,
                                    DungeonEditorHandleRef::clusterId,
                                    DungeonEditorHandleRef::corridorId,
                                    DungeonEditorHandleRef::roomId,
                                    DungeonEditorHandleRef::index,
                                    handle -> handle.cell().q(),
                                    handle -> handle.cell().r(),
                                    handle -> handle.cell().level(),
                                    DungeonEditorHandleRef::direction),
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::preview),
                    DungeonEditorMapProjectionSnapshot::graphNodes,
                    new DungeonMapProjectionElements.GraphNodeReader<>(
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::id,
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::clusterId,
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::label,
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::q,
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::r,
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::selected),
                    DungeonEditorMapProjectionSnapshot::graphLinks,
                    new DungeonMapProjectionElements.GraphLinkReader<>(
                            DungeonEditorMapProjectionSnapshot.GraphLinkProjection::fromId,
                            DungeonEditorMapProjectionSnapshot.GraphLinkProjection::toId,
                            DungeonEditorMapProjectionSnapshot.GraphLinkProjection::selected),
                    ignored -> null,
                    null);

    private DungeonMapEditorProjectionAccess() {
    }
}

final class DungeonMapTravelProjectionAccess {

    static final DungeonMapProjectionElements.ProjectionAccess<
            TravelDungeonMapProjectionSnapshot,
            TravelDungeonMapProjectionSnapshot.CellProjection,
            TravelDungeonMapProjectionSnapshot.EdgeProjection,
            TravelDungeonMapProjectionSnapshot.LabelProjection,
            TravelDungeonMapProjectionSnapshot.MarkerProjection,
            TravelDungeonMapProjectionSnapshot.GraphNodeProjection,
            TravelDungeonMapProjectionSnapshot.GraphLinkProjection,
            TravelDungeonMapProjectionSnapshot.PartyTokenProjection> ACCESS =
            new DungeonMapProjectionElements.ProjectionAccess<>(
                    TravelDungeonMapProjectionSnapshot::mapName,
                    TravelDungeonMapProjectionSnapshot::width,
                    TravelDungeonMapProjectionSnapshot::height,
                    projection -> DungeonMapRenderState.Topology.fromTravel(projection.topology()),
                    TravelDungeonMapProjectionSnapshot::cells,
                    new DungeonMapProjectionElements.CellReader<>(
                            TravelDungeonMapProjectionSnapshot.CellProjection::q,
                            TravelDungeonMapProjectionSnapshot.CellProjection::r,
                            TravelDungeonMapProjectionSnapshot.CellProjection::level,
                            TravelDungeonMapProjectionSnapshot.CellProjection::label,
                            cell -> cell.kind().name(),
                            TravelDungeonMapProjectionSnapshot.CellProjection::ownerId,
                            TravelDungeonMapProjectionSnapshot.CellProjection::clusterId,
                            cell -> cell.topologyRef().kind(),
                            cell -> cell.topologyRef().id(),
                            TravelDungeonMapProjectionSnapshot.CellProjection::selected,
                            TravelDungeonMapProjectionSnapshot.CellProjection::overlay,
                            TravelDungeonMapProjectionSnapshot.CellProjection::preview,
                            TravelDungeonMapProjectionSnapshot.CellProjection::destructivePreview),
                    TravelDungeonMapProjectionSnapshot::edges,
                    new DungeonMapProjectionElements.EdgeReader<>(
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::startQ,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::startR,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::endQ,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::endR,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::level,
                            edge -> edge.kind().name(),
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::label,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::ownerId,
                            edge -> edge.topologyRef().kind(),
                            edge -> edge.topologyRef().id(),
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::selected,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::preview),
                    TravelDungeonMapProjectionSnapshot::labels,
                    new DungeonMapProjectionElements.LabelReader<>(
                            TravelDungeonMapProjectionSnapshot.LabelProjection::label,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::q,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::r,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::level,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::ownerId,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::clusterId,
                            label -> label.topologyRef().kind(),
                            label -> label.topologyRef().id(),
                            TravelDungeonMapProjectionSnapshot.LabelProjection::selected,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::preview),
                    TravelDungeonMapProjectionSnapshot::markers,
                    new DungeonMapProjectionElements.MarkerReader<>(
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::label,
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::q,
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::r,
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::level,
                            marker -> marker.kind().name(),
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::selected,
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::handle,
                            new DungeonMapProjectionElements.MarkerHandleReader<>(
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::kind,
                                    handle -> handle.topologyRef().kind(),
                                    handle -> handle.topologyRef().id(),
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::ownerId,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::clusterId,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::corridorId,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::roomId,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::index,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::q,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::r,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::level,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::direction),
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::preview),
                    TravelDungeonMapProjectionSnapshot::graphNodes,
                    new DungeonMapProjectionElements.GraphNodeReader<>(
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::id,
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::clusterId,
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::label,
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::q,
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::r,
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::selected),
                    TravelDungeonMapProjectionSnapshot::graphLinks,
                    new DungeonMapProjectionElements.GraphLinkReader<>(
                            TravelDungeonMapProjectionSnapshot.GraphLinkProjection::fromId,
                            TravelDungeonMapProjectionSnapshot.GraphLinkProjection::toId,
                            TravelDungeonMapProjectionSnapshot.GraphLinkProjection::selected),
                    TravelDungeonMapProjectionSnapshot::partyToken,
                    new DungeonMapProjectionElements.PartyTokenReader<>(
                            TravelDungeonMapProjectionSnapshot.PartyTokenProjection::q,
                            TravelDungeonMapProjectionSnapshot.PartyTokenProjection::r,
                            TravelDungeonMapProjectionSnapshot.PartyTokenProjection::level,
                            token -> token.heading().name(),
                            TravelDungeonMapProjectionSnapshot.PartyTokenProjection::visible));

    private DungeonMapTravelProjectionAccess() {
    }
}
