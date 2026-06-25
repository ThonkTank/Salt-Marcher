package src.features.dungeon.runtime;

import java.util.Locale;
import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonEditorHandleRef;

public record DungeonEditorRuntimePointerTarget(
        TargetKind targetKind,
        LabelKind labelKind,
        ElementKind elementKind,
        long ownerId,
        long clusterId,
        TopologyKind topologyKind,
        long topologyId,
        DungeonEditorHandleRef handleRef,
        BoundaryTarget boundary,
        SyntheticHoverKind syntheticHoverKind,
        CellTarget cell,
        VertexTarget vertex
) {
    private static final long EMPTY_ID = 0L;

    public DungeonEditorRuntimePointerTarget {
        targetKind = targetKind == null ? TargetKind.EMPTY : targetKind;
        labelKind = labelKind == null ? LabelKind.EMPTY : labelKind;
        elementKind = elementKind == null ? ElementKind.EMPTY : elementKind;
        ownerId = Math.max(0L, ownerId);
        clusterId = Math.max(0L, clusterId);
        topologyKind = topologyKind == null ? TopologyKind.EMPTY : topologyKind;
        topologyId = Math.max(0L, topologyId);
        handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
        boundary = boundary == null ? BoundaryTarget.empty() : boundary;
        syntheticHoverKind = syntheticHoverKind == null ? SyntheticHoverKind.NONE : syntheticHoverKind;
        cell = cell == null ? CellTarget.empty() : cell;
        vertex = vertex == null ? VertexTarget.empty() : vertex;
    }

    public static DungeonEditorRuntimePointerTarget empty() {
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.EMPTY,
                LabelKind.EMPTY,
                ElementKind.EMPTY,
                EMPTY_ID,
                EMPTY_ID,
                TopologyKind.EMPTY,
                EMPTY_ID,
                DungeonEditorHandleRef.empty(),
                BoundaryTarget.empty(),
                SyntheticHoverKind.NONE,
                CellTarget.empty(),
                VertexTarget.empty());
    }

    public static DungeonEditorRuntimePointerTarget cell(
            ElementKind elementKind,
            long ownerId,
            long clusterId,
            TopologyKind topologyKind,
            long topologyId
    ) {
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.CELL,
                LabelKind.EMPTY,
                elementKind,
                ownerId,
                clusterId,
                topologyKind,
                topologyId,
                DungeonEditorHandleRef.empty(),
                BoundaryTarget.empty(),
                syntheticHoverKind(TargetKind.CELL, ownerId, topologyKind, topologyId, BoundaryTarget.empty()),
                CellTarget.empty(),
                VertexTarget.empty());
    }

    public static DungeonEditorRuntimePointerTarget syntheticCell(String elementKind, int q, int r, int level) {
        ElementKind runtimeElementKind = ElementKind.fromLegacy(elementKind);
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.CELL,
                LabelKind.EMPTY,
                runtimeElementKind,
                EMPTY_ID,
                EMPTY_ID,
                TopologyKind.EMPTY,
                EMPTY_ID,
                DungeonEditorHandleRef.empty(),
                BoundaryTarget.empty(),
                SyntheticHoverKind.CELL,
                new CellTarget(true, q, r, level),
                VertexTarget.empty());
    }

    public static DungeonEditorRuntimePointerTarget label(
            LabelKind labelKind,
            long ownerId,
            long clusterId,
            TopologyKind topologyKind,
            long topologyId
    ) {
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.LABEL,
                labelKind,
                ElementKind.fromTopology(topologyKind),
                ownerId,
                clusterId,
                topologyKind,
                topologyId,
                DungeonEditorHandleRef.empty(),
                BoundaryTarget.empty(),
                SyntheticHoverKind.NONE,
                CellTarget.empty(),
                VertexTarget.empty());
    }

    public static DungeonEditorRuntimePointerTarget graphNode(
            long ownerId,
            long clusterId,
            TopologyKind topologyKind,
            long topologyId
    ) {
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.GRAPH_NODE,
                LabelKind.EMPTY,
                ElementKind.fromTopology(topologyKind),
                ownerId,
                clusterId,
                topologyKind,
                topologyId,
                DungeonEditorHandleRef.empty(),
                BoundaryTarget.empty(),
                SyntheticHoverKind.NONE,
                CellTarget.empty(),
                VertexTarget.empty());
    }

    public static DungeonEditorRuntimePointerTarget handle(DungeonEditorHandleRef handleRef) {
        DungeonEditorHandleRef safeHandle = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
        TopologyKind topologyKind = TopologyKind.fromLegacy(safeHandle.topologyRef().kind().name());
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.HANDLE,
                LabelKind.EMPTY,
                ElementKind.fromTopology(topologyKind),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                topologyKind,
                safeHandle.topologyRef().id(),
                safeHandle,
                BoundaryTarget.empty(),
                SyntheticHoverKind.NONE,
                CellTarget.empty(),
                VertexTarget.empty());
    }

    public static DungeonEditorRuntimePointerTarget boundary(BoundaryTarget boundary) {
        BoundaryTarget safeBoundary = boundary == null ? BoundaryTarget.empty() : boundary;
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.BOUNDARY,
                LabelKind.EMPTY,
                ElementKind.fromBoundary(safeBoundary.boundaryKind()),
                safeBoundary.ownerId(),
                0L,
                safeBoundary.topologyKind(),
                safeBoundary.topologyId(),
                DungeonEditorHandleRef.empty(),
                safeBoundary,
                syntheticHoverKind(TargetKind.BOUNDARY, safeBoundary.ownerId(), safeBoundary.topologyKind(),
                        safeBoundary.topologyId(), safeBoundary),
                CellTarget.empty(),
                VertexTarget.empty());
    }

    public static DungeonEditorRuntimePointerTarget vertex(int q, int r, int level) {
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.VERTEX,
                LabelKind.EMPTY,
                ElementKind.WALL_VERTEX,
                EMPTY_ID,
                EMPTY_ID,
                TopologyKind.EMPTY,
                EMPTY_ID,
                DungeonEditorHandleRef.empty(),
                BoundaryTarget.empty(),
                SyntheticHoverKind.VERTEX,
                CellTarget.empty(),
                new VertexTarget(true, q, r, level));
    }

    DungeonTopologyElementKind topologyElementKind() {
        try {
            return DungeonTopologyElementKind.valueOf(topologyKind.legacyName());
        } catch (IllegalArgumentException ignored) {
            return DungeonTopologyElementKind.EMPTY;
        }
    }

    DungeonTopologyRef topologyRef() {
        return DungeonEditorRuntimeInputValues.topologyRef(topologyKind.legacyName(), topologyId);
    }

    private static SyntheticHoverKind syntheticHoverKind(
            TargetKind targetKind,
            long ownerId,
            TopologyKind topologyKind,
            long topologyId,
            BoundaryTarget boundary
    ) {
        if (targetKind == TargetKind.VERTEX) {
            return SyntheticHoverKind.VERTEX;
        }
        if (targetKind == TargetKind.CELL && ownerId == EMPTY_ID
                && (topologyKind == TopologyKind.EMPTY || topologyId == EMPTY_ID)) {
            return SyntheticHoverKind.CELL;
        }
        if (targetKind == TargetKind.BOUNDARY && boundary != null && boundary.key().startsWith("hover-boundary:")) {
            return SyntheticHoverKind.BOUNDARY;
        }
        return SyntheticHoverKind.NONE;
    }

    public boolean hasSyntheticHover() {
        return syntheticHoverKind != SyntheticHoverKind.NONE;
    }

    public boolean isSyntheticCellHover() {
        return syntheticHoverKind == SyntheticHoverKind.CELL;
    }

    public boolean isCellTarget() {
        return targetKind == TargetKind.CELL;
    }

    public boolean isBoundaryTarget() {
        return targetKind == TargetKind.BOUNDARY;
    }

    public boolean isVertexTarget() {
        return targetKind == TargetKind.VERTEX;
    }

    public boolean isHandleTarget() {
        return targetKind == TargetKind.HANDLE;
    }

    public boolean isLabelTarget() {
        return targetKind == TargetKind.LABEL;
    }

    public boolean isGraphNodeTarget() {
        return targetKind == TargetKind.GRAPH_NODE && stableTopology();
    }

    public boolean isRoomLabelTarget() {
        return labelKind == LabelKind.ROOM_LABEL;
    }

    public boolean isClusterLabelTarget() {
        return labelKind == LabelKind.CLUSTER_LABEL;
    }

    public boolean isFeatureLabelTarget() {
        return labelKind == LabelKind.FEATURE_LABEL;
    }

    public boolean isSelectableLabelTarget() {
        return isLabelTarget() && (isClusterLabelTarget() || isFeatureLabelTarget());
    }

    public boolean isSelectableCellTarget() {
        return isCellTarget() && stableTopology();
    }

    public boolean isDoorBoundaryTarget() {
        return isBoundaryTarget() && boundary.boundaryKind() == BoundaryKind.DOOR;
    }

    public boolean isCorridorCellTarget() {
        return isCellTarget() && elementKind == ElementKind.CORRIDOR;
    }

    public boolean isWallOrDoorBoundaryTarget() {
        return isBoundaryTarget()
                && (boundary.boundaryKind() == BoundaryKind.WALL || boundary.boundaryKind() == BoundaryKind.DOOR);
    }

    private boolean stableTopology() {
        return topologyId > EMPTY_ID && topologyKind != TopologyKind.EMPTY;
    }

    public int cellQ() {
        return cell.q();
    }

    public int cellR() {
        return cell.r();
    }

    public int cellLevel() {
        return cell.level();
    }

    public int vertexQ() {
        return vertex.q();
    }

    public int vertexR() {
        return vertex.r();
    }

    public int vertexLevel() {
        return vertex.level();
    }

    public enum TargetKind {
        EMPTY,
        CELL,
        LABEL,
        GRAPH_NODE,
        HANDLE,
        BOUNDARY,
        VERTEX;

        public static TargetKind fromLegacy(String value) {
            return switch (normalized(value)) {
                case "CELL" -> CELL;
                case "LABEL" -> LABEL;
                case "GRAPH_NODE" -> GRAPH_NODE;
                case "HANDLE" -> HANDLE;
                case "BOUNDARY" -> BOUNDARY;
                case "VERTEX" -> VERTEX;
                default -> EMPTY;
            };
        }
    }

    public enum LabelKind {
        EMPTY,
        ROOM_LABEL,
        CLUSTER_LABEL,
        FEATURE_LABEL;

        public static LabelKind fromLegacy(String value) {
            return switch (normalized(value)) {
                case "ROOM_LABEL" -> ROOM_LABEL;
                case "CLUSTER_LABEL" -> CLUSTER_LABEL;
                case "FEATURE_LABEL" -> FEATURE_LABEL;
                default -> EMPTY;
            };
        }

        public String legacyName() {
            return this == EMPTY ? "" : name();
        }
    }

    public enum ElementKind {
        EMPTY,
        ROOM,
        CORRIDOR,
        CORRIDOR_ANCHOR,
        STAIR,
        TRANSITION,
        FEATURE_MARKER,
        FEATURE_OBJECT,
        FEATURE_ENCOUNTER,
        FEATURE_POI,
        WALL,
        DOOR,
        WALL_VERTEX;

        @SuppressWarnings("PMD.CyclomaticComplexity")
        public static ElementKind fromLegacy(String value) {
            return switch (normalized(value)) {
                case "ROOM" -> ROOM;
                case "CORRIDOR" -> CORRIDOR;
                case "CORRIDOR_ANCHOR" -> CORRIDOR_ANCHOR;
                case "STAIR" -> STAIR;
                case "TRANSITION" -> TRANSITION;
                case "FEATURE_MARKER" -> FEATURE_MARKER;
                case "FEATURE_OBJECT" -> FEATURE_OBJECT;
                case "FEATURE_ENCOUNTER" -> FEATURE_ENCOUNTER;
                case "FEATURE_POI" -> FEATURE_POI;
                case "WALL" -> WALL;
                case "DOOR" -> DOOR;
                case "WALL_VERTEX" -> WALL_VERTEX;
                default -> EMPTY;
            };
        }

        @SuppressWarnings("PMD.CyclomaticComplexity")
        public static ElementKind fromTopology(TopologyKind topologyKind) {
            return switch (topologyKind == null ? TopologyKind.EMPTY : topologyKind) {
                case ROOM -> ROOM;
                case CORRIDOR -> CORRIDOR;
                case CORRIDOR_ANCHOR -> CORRIDOR_ANCHOR;
                case STAIR -> STAIR;
                case TRANSITION -> TRANSITION;
                case FEATURE_MARKER -> FEATURE_MARKER;
                case DOOR -> DOOR;
                case WALL -> WALL;
                default -> EMPTY;
            };
        }

        public static ElementKind fromBoundary(BoundaryKind boundaryKind) {
            return boundaryKind == BoundaryKind.DOOR ? DOOR : WALL;
        }

        public String legacyName() {
            return this == EMPTY ? "" : name();
        }
    }

    public enum TopologyKind {
        EMPTY,
        ROOM,
        CORRIDOR,
        CORRIDOR_ANCHOR,
        DOOR,
        WALL,
        STAIR,
        TRANSITION,
        FEATURE_MARKER;

        public static TopologyKind fromLegacy(String value) {
            return switch (normalized(value)) {
                case "ROOM" -> ROOM;
                case "CORRIDOR" -> CORRIDOR;
                case "CORRIDOR_ANCHOR" -> CORRIDOR_ANCHOR;
                case "DOOR" -> DOOR;
                case "WALL" -> WALL;
                case "STAIR" -> STAIR;
                case "TRANSITION" -> TRANSITION;
                case "FEATURE_MARKER" -> FEATURE_MARKER;
                default -> EMPTY;
            };
        }

        public String legacyName() {
            return this == EMPTY ? "" : name();
        }
    }

    public enum BoundaryKind {
        WALL,
        DOOR;

        public static BoundaryKind fromLegacy(String value) {
            return "DOOR".equals(normalized(value)) ? DOOR : WALL;
        }

        DungeonEditorWorkspaceValues.BoundaryKind workspaceKind() {
            return this == DOOR
                    ? DungeonEditorWorkspaceValues.BoundaryKind.DOOR
                    : DungeonEditorWorkspaceValues.BoundaryKind.WALL;
        }

        public String legacyName() {
            return name();
        }
    }

    public enum SyntheticHoverKind {
        NONE,
        CELL,
        BOUNDARY,
        VERTEX;

        public static SyntheticHoverKind fromLegacy(String value) {
            return switch (normalized(value)) {
                case "CELL" -> CELL;
                case "BOUNDARY" -> BOUNDARY;
                case "VERTEX" -> VERTEX;
                default -> NONE;
            };
        }
    }

    public record CellTarget(boolean exact, int q, int r, int level) {
        public static CellTarget empty() {
            return new CellTarget(false, 0, 0, 0);
        }
    }

    public record VertexTarget(boolean exact, int q, int r, int level) {
        public static VertexTarget empty() {
            return new VertexTarget(false, 0, 0, 0);
        }
    }

    public record BoundaryTarget(
            BoundaryKind boundaryKind,
            String key,
            long ownerId,
            TopologyKind topologyKind,
            long topologyId,
            double startQ,
            double startR,
            int startLevel,
            double endQ,
            double endR,
            int endLevel
    ) {
        public BoundaryTarget {
            boundaryKind = Objects.requireNonNull(boundaryKind, "boundaryKind");
            key = Objects.requireNonNull(key, "key").strip();
            requireNonNegative(ownerId, "ownerId");
            topologyKind = Objects.requireNonNull(topologyKind, "topologyKind");
            requireNonNegative(topologyId, "topologyId");
            requireFinite(startQ, "startQ");
            requireFinite(startR, "startR");
            requireFinite(endQ, "endQ");
            requireFinite(endR, "endR");
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget(
                    BoundaryKind.WALL,
                    "",
                    0L,
                    TopologyKind.EMPTY,
                    0L,
                    0.0,
                    0.0,
                    0,
                    0.0,
                    0.0,
                    0);
        }

    }

    private static String normalized(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
    }

    private static void requireNonNegative(long value, String fieldName) {
        if (value < EMPTY_ID) {
            throw new IllegalArgumentException(fieldName + " must be non-negative");
        }
    }

    private static void requireFinite(double value, String fieldName) {
        if (!Double.isFinite(value)) {
            throw new IllegalArgumentException(fieldName + " must be finite");
        }
    }
}
