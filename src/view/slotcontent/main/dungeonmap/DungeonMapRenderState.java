package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedLabelKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedTopologyKind;

// Render-state values
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
            selectToolLabel(),
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

    static Topology fromPublished(DungeonTopologyKind topologyKind) {
        return topologyKind == DungeonTopologyKind.HEX ? HEX : SQUARE;
    }

    static Topology fromName(String topologyName) {
        return "HEX".equalsIgnoreCase(topologyName) ? HEX : SQUARE;
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
    TRANSITION,
    FEATURE_POI,
    FEATURE_OBJECT,
    FEATURE_ENCOUNTER;
}

enum EdgeKind {
    WALL,
    DOOR;
}

enum MarkerKind {
    DOOR,
    STAIR,
    TRANSITION,
    WAYPOINT,
    CLUSTER,
    FEATURE_POI,
    FEATURE_OBJECT,
    FEATURE_ENCOUNTER;
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

    static Heading fromEditor(DungeonTravelHeading heading) {
        if (heading == null) {
            return SOUTH;
        }
        return switch (heading) {
            case NORTH -> NORTH;
            case EAST -> EAST;
            case WEST -> WEST;
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

    LevelOverlaySettings {
        mode = mode == null ? OverlayMode.OFF : mode;
        levelRange = Math.max(1, Math.min(maximumLevelRange(), levelRange));
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
        return new LevelOverlaySettings(OverlayMode.NEARBY, defaultLevelRange(), defaultOpacity(), List.of());
    }

    static LevelOverlaySettings off() {
        return new LevelOverlaySettings(OverlayMode.OFF, defaultLevelRange(), defaultOpacity(), List.of());
    }

    private static int defaultLevelRange() {
        return 2;
    }

    private static int maximumLevelRange() {
        return 6;
    }

    private static double defaultOpacity() {
        return 0.35;
    }
}

record TopologyRef(PreparedTopologyKind kind, long id) {

    TopologyRef {
        kind = kind == null ? PreparedTopologyKind.EMPTY : kind;
        id = Math.max(0L, id);
    }

    boolean isEmpty() {
        return id <= 0L || kind == PreparedTopologyKind.EMPTY;
    }

    static TopologyRef empty() {
        return new TopologyRef(PreparedTopologyKind.EMPTY, 0L);
    }
}

record MarkerHandle(
        @Nullable DungeonEditorHandleRef ref,
        int q,
        int r,
        int level,
        DungeonMapRenderState.TopologyRef explicitTopologyRef
) {
    @Nullable DungeonEditorHandleKind kind() {
        return ref == null ? null : ref.kind();
    }

        DungeonMapRenderState.TopologyRef topologyRef() {
            if (ref != null) {
                return DungeonMapRenderElementFactory.topologyRef(ref.topologyRef());
            }
            return explicitTopologyRef == null ? TopologyRef.empty() : explicitTopologyRef;
        }

    String direction() {
        return ref == null ? "" : ref.direction();
    }

    @Nullable DungeonEdgeRef sourceEdge() {
        return ref == null ? null : ref.sourceEdge();
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
        PreparedLabelKind labelKind,
        boolean selected,
        boolean preview,
        double availableWidthScene,
        double rotationDegrees
) {

    Label {
        label = label == null ? "" : label;
        topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        labelKind = labelKind == null ? PreparedLabelKind.EMPTY : labelKind;
        availableWidthScene = Math.max(0.0, availableWidthScene);
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
        boolean preview,
        @Nullable DungeonEdgeRef sourceEdge,
        String hoverLabel
) {
    Marker(
            String label,
            double q,
            double r,
            int z,
            DungeonMapRenderState.MarkerKind kind,
            boolean selected,
            DungeonMapRenderState.MarkerHandle handle,
            boolean preview
    ) {
        this(label, q, r, z, kind, selected, handle, preview, null, "");
    }

    Marker {
        label = label == null ? "" : label;
        hoverLabel = hoverLabel == null ? "" : hoverLabel.trim();
        kind = kind == null ? MarkerKind.DOOR : kind;
        handle = handle == null
                ? new MarkerHandle(null, 0, 0, 0, null)
                : handle;
    }

    boolean isDoorMarker() {
        return kind == MarkerKind.DOOR;
    }

    boolean isTransitionMarker() {
        return kind == MarkerKind.TRANSITION;
    }

    boolean isWallRunMarker() {
        return handle.kind() == DungeonEditorHandleKind.CLUSTER_WALL_RUN;
    }

    boolean isClusterCornerMarker() {
        return handle.kind() == DungeonEditorHandleKind.CLUSTER_CORNER;
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
    return title == null || title.isBlank() ? DungeonMapContentModel.defaultTitle() : title.trim();
}

private static String normalizeTool(String selectedTool) {
    return selectedTool == null || selectedTool.isBlank() ? selectToolLabel() : selectedTool;
}

static String selectToolLabel() {
    return DungeonEditorTool.SELECT.displayLabel();
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
