package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

public record DungeonMapRenderState(
        String title,
        boolean projectionAvailable,
        int width,
        int height,
        Topology topology,
        ViewMode viewMode,
        LevelOverlaySettings overlaySettings,
        int projectionLevel,
        boolean editorMode,
        String selectedTool,
        String emptyMessage,
        List<Cell> cells,
        List<Edge> edges,
        List<Label> labels,
        List<Marker> markers,
        List<GraphNode> graphNodes,
        List<GraphLink> graphLinks,
        @Nullable PartyToken partyToken
) {

    public static final String SELECT_TOOL_LABEL = "Auswahl";
    private static final String EMPTY_KIND = "EMPTY";

    public DungeonMapRenderState {
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

    public String subtitle() {
        if (!projectionAvailable) {
            return "";
        }
        return width + " x " + height + " grid · z=" + projectionLevel;
    }

    public String modeLabel() {
        return viewMode.label();
    }

    public String statusLabel() {
        return editorMode ? selectedTool : "Token auf der Karte ziehen";
    }

    public String summaryLabel() {
        if (!projectionAvailable) {
            return "";
        }
        return cells.size() + " cells, " + edges.size() + " edges · " + overlaySettings.mode().label();
    }

    public boolean mapLoaded() {
        return !(cells.isEmpty()
                && edges.isEmpty()
                && labels.isEmpty()
                && markers.isEmpty()
                && graphNodes.isEmpty());
    }

    public String overlayMessage() {
        return mapLoaded() ? "" : emptyMessage;
    }

    public DungeonMapRenderState withViewMode(ViewMode nextViewMode) {
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

    public DungeonMapRenderState withOverlaySettings(LevelOverlaySettings nextOverlaySettings) {
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

    public DungeonMapRenderState withProjectionLevel(int nextProjectionLevel) {
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

    public DungeonMapRenderState withSelectedTool(String nextSelectedTool) {
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

    public static DungeonMapRenderState empty(String title, boolean editorMode) {
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

    public enum Topology {
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

        public static OverlayMode fromKey(String modeKey) {
            return switch (modeKey == null ? "" : modeKey.trim().toUpperCase()) {
                case "NEARBY" -> NEARBY;
                case "SELECTED" -> SELECTED;
                default -> OFF;
            };
        }
    }

    public enum CellKind {
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION;

        public static CellKind fromKey(String kindKey) {
            return switch (kindKey == null ? "" : kindKey.trim().toUpperCase()) {
                case "CORRIDOR" -> CORRIDOR;
                case "STAIR" -> STAIR;
                case "TRANSITION" -> TRANSITION;
                default -> ROOM;
            };
        }
    }

    public enum EdgeKind {
        WALL,
        DOOR;

        public static EdgeKind fromKey(String kindKey) {
            return "DOOR".equalsIgnoreCase(kindKey) ? DOOR : WALL;
        }
    }

    public enum MarkerKind {
        DOOR,
        STAIR,
        TRANSITION,
        WAYPOINT,
        CLUSTER;

        public static MarkerKind fromKey(String kindKey) {
            return switch (kindKey == null ? "" : kindKey.trim().toUpperCase()) {
                case "STAIR" -> STAIR;
                case "TRANSITION" -> TRANSITION;
                case "WAYPOINT" -> WAYPOINT;
                case "CLUSTER" -> CLUSTER;
                default -> DOOR;
            };
        }
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

        public static Heading fromName(String headingName) {
            return switch (headingName == null ? "" : headingName.trim().toUpperCase()) {
                case "NORTH" -> NORTH;
                case "EAST" -> EAST;
                case "WEST" -> WEST;
                default -> SOUTH;
            };
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

        public boolean selectsLevel(int level) {
            return selectedLevels().contains(level);
        }

        public static LevelOverlaySettings defaults() {
            return new LevelOverlaySettings(OverlayMode.NEARBY, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
        }

        public static LevelOverlaySettings off() {
            return new LevelOverlaySettings(OverlayMode.OFF, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
        }
    }

    public record TopologyRef(String kind, long id) {

        public TopologyRef {
            kind = kind == null || kind.isBlank() ? EMPTY_KIND : kind.trim();
            id = Math.max(0L, id);
        }

        public boolean isEmpty() {
            return id <= 0L || EMPTY_KIND.equals(kind);
        }

        public static TopologyRef empty() {
            return new TopologyRef(EMPTY_KIND, 0L);
        }
    }

    public record MarkerHandle(
            String kind,
            TopologyRef topologyRef,
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

        public MarkerHandle {
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

    public record Cell(
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

        public Cell {
            label = label == null ? "" : label;
            kind = kind == null ? CellKind.ROOM : kind;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public record Edge(
            double startQ,
            double startR,
            double endQ,
            double endR,
            int z,
            EdgeKind kind,
            String label,
            long ownerId,
            TopologyRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        public Edge {
            kind = kind == null ? EdgeKind.WALL : kind;
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public record Label(
            String label,
            double q,
            double r,
            int z,
            long ownerId,
            long clusterId,
            TopologyRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        public Label {
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public record Marker(
            String label,
            double q,
            double r,
            int z,
            MarkerKind kind,
            boolean selected,
            MarkerHandle handle,
            boolean preview
    ) {

        public Marker {
            label = label == null ? "" : label;
            kind = kind == null ? MarkerKind.DOOR : kind;
            handle = handle == null ? new MarkerHandle(EMPTY_KIND, TopologyRef.empty(), 0L, 0L, 0L, 0L, 0, 0, 0, 0, "") : handle;
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

    private static <T> List<T> immutableList(@Nullable List<T> items) {
        return items == null ? List.of() : List.copyOf(items);
    }
}
