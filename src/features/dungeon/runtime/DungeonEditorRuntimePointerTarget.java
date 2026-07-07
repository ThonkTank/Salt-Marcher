package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
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
            long topologyId,
            int q,
            int r,
            int level
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
                new CellTarget(true, q, r, level),
                VertexTarget.empty());
    }

    public static DungeonEditorRuntimePointerTarget syntheticCell(ElementKind elementKind, int q, int r, int level) {
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.CELL,
                LabelKind.EMPTY,
                elementKind,
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

    public static DungeonEditorRuntimePointerTarget marker(
            ElementKind elementKind,
            long ownerId,
            long clusterId,
            TopologyKind topologyKind,
            long topologyId
    ) {
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.MARKER,
                LabelKind.EMPTY,
                elementKind,
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
        TopologyKind topologyKind = TopologyKind.fromPublished(safeHandle.topologyRef().kind());
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

    static DungeonEditorRuntimePointerTarget fromPreparedFrame(
            DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame target
    ) {
        DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame safeTarget = target == null
                ? DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame.empty()
                : target;
        return new DungeonEditorRuntimePointerTarget(
                TargetKind.fromPrepared(safeTarget.targetKind()),
                LabelKind.fromPrepared(safeTarget.labelKind()),
                ElementKind.fromPrepared(safeTarget.elementKind()),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                TopologyKind.fromPrepared(safeTarget.topologyKind()),
                safeTarget.topologyId(),
                safeTarget.handleRef(),
                runtimeBoundaryTarget(safeTarget.boundary()),
                SyntheticHoverKind.fromPrepared(safeTarget.syntheticHoverKind()),
                runtimeCellTarget(safeTarget),
                new VertexTarget(
                        safeTarget.vertex().exact(),
                        safeTarget.vertex().q(),
                        safeTarget.vertex().r(),
                        safeTarget.vertex().level()));
    }

    private static CellTarget runtimeCellTarget(
            DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame target
    ) {
        if (target.cell().exact()) {
            return new CellTarget(true, target.cell().q(), target.cell().r(), target.cell().level());
        }
        return CellTarget.empty();
    }

    private static BoundaryTarget runtimeBoundaryTarget(
            DungeonEditorPreparedFrameFacts.PreparedBoundaryTargetFrame boundary
    ) {
        DungeonEditorPreparedFrameFacts.PreparedBoundaryTargetFrame safeBoundary = boundary == null
                ? DungeonEditorPreparedFrameFacts.PreparedBoundaryTargetFrame.empty()
                : boundary;
        return new BoundaryTarget(
                BoundaryKind.fromPrepared(safeBoundary.boundaryKind()),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                TopologyKind.fromPrepared(safeBoundary.topologyKind()),
                safeBoundary.topologyId(),
                safeBoundary.startQ(),
                safeBoundary.startR(),
                safeBoundary.startLevel(),
                safeBoundary.endQ(),
                safeBoundary.endR(),
                safeBoundary.endLevel());
    }

    DungeonTopologyElementKind topologyElementKind() {
        return topologyKind.domainKind();
    }

    DungeonTopologyRef topologyRef() {
        return topologyKind.ref(topologyId);
    }

    private static SyntheticHoverKind syntheticHoverKind(
            TargetKind targetKind,
            long ownerId,
            TopologyKind topologyKind,
            long topologyId,
            BoundaryTarget boundary
    ) {
        TargetKind safeTargetKind = targetKind == null ? TargetKind.EMPTY : targetKind;
        TopologyKind safeTopologyKind = topologyKind == null ? TopologyKind.defaultKind() : topologyKind;
        BoundaryTarget safeBoundary = boundary == null ? BoundaryTarget.empty() : boundary;
        return safeTargetKind.syntheticHoverKind(ownerId, safeTopologyKind, topologyId, safeBoundary);
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

    public boolean isMarkerTarget() {
        return targetKind == TargetKind.MARKER;
    }

    public boolean isGraphNodeTarget() {
        return targetKind == TargetKind.GRAPH_NODE && stableTopology();
    }

    public boolean isRoomLabelTarget() {
        return labelKind.isRoomLabel();
    }

    public boolean isClusterLabelTarget() {
        return labelKind.isClusterLabel();
    }

    public boolean isSelectableLabelTarget() {
        return isLabelTarget() && isClusterLabelTarget();
    }

    public boolean isSelectableCellTarget() {
        return isCellTarget() && stableTopology();
    }

    public boolean isSelectableMarkerTarget() {
        return isMarkerTarget() && stableTopology();
    }

    public boolean isDoorBoundaryTarget() {
        return isBoundaryTarget() && boundary.boundaryKind().isDoor();
    }

    public boolean isCorridorCellTarget() {
        return isCellTarget() && elementKind == ElementKind.CORRIDOR;
    }

    boolean hasTransitionElement() {
        return elementKind == ElementKind.TRANSITION;
    }

    boolean hasRoomElement() {
        return elementKind == ElementKind.ROOM;
    }

    boolean hasFeatureMarkerElement() {
        return elementKind == ElementKind.FEATURE_MARKER;
    }

    public boolean isWallOrDoorBoundaryTarget() {
        return isBoundaryTarget();
    }

    private boolean stableTopology() {
        return topologyId > EMPTY_ID && !topologyKind.isEmpty();
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
        CELL {
            @Override
            SyntheticHoverKind syntheticHoverKind(
                    long ownerId,
                    TopologyKind topologyKind,
                    long topologyId,
                    BoundaryTarget boundary
            ) {
                return topologyKind.syntheticCellHover(ownerId, topologyId)
                        ? SyntheticHoverKind.CELL
                        : SyntheticHoverKind.NONE;
            }
        },
        LABEL,
        MARKER,
        GRAPH_NODE,
        HANDLE,
        BOUNDARY {
            @Override
            SyntheticHoverKind syntheticHoverKind(
                    long ownerId,
                    TopologyKind topologyKind,
                    long topologyId,
                    BoundaryTarget boundary
            ) {
                return boundary.hoverBoundary() ? SyntheticHoverKind.BOUNDARY : SyntheticHoverKind.NONE;
            }
        },
        VERTEX {
            @Override
            SyntheticHoverKind syntheticHoverKind(
                    long ownerId,
                    TopologyKind topologyKind,
                    long topologyId,
                    BoundaryTarget boundary
            ) {
                return SyntheticHoverKind.VERTEX;
            }
        };

        static TargetKind fromPrepared(DungeonEditorPreparedFrameFacts.PreparedTargetKind kind) {
            return kind == null ? EMPTY : TargetKind.valueOf(kind.name());
        }

        SyntheticHoverKind syntheticHoverKind(
                long ownerId,
                TopologyKind topologyKind,
                long topologyId,
                BoundaryTarget boundary
        ) {
            return SyntheticHoverKind.NONE;
        }
    }

    public enum LabelKind {
        EMPTY,
        ROOM_LABEL,
        CLUSTER_LABEL,
        FEATURE_LABEL;

        static LabelKind defaultKind() {
            return EMPTY;
        }

        static LabelKind fromPrepared(DungeonEditorPreparedFrameFacts.PreparedLabelKind kind) {
            return kind == null ? EMPTY : LabelKind.valueOf(kind.name());
        }

        boolean isRoomLabel() {
            return this == ROOM_LABEL;
        }

        boolean isClusterLabel() {
            return this == CLUSTER_LABEL;
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
            return boundaryKind != null && boundaryKind.isDoor() ? DOOR : WALL;
        }

        static ElementKind fromPrepared(DungeonEditorPreparedFrameFacts.PreparedElementKind kind) {
            return kind == null ? EMPTY : ElementKind.valueOf(kind.name());
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

        public static TopologyKind fromDomain(DungeonTopologyElementKind kind) {
            return kind == null ? EMPTY : fromDomainKind(kind);
        }

        public static TopologyKind fromPublished(src.domain.dungeon.published.DungeonTopologyElementKind kind) {
            return kind == null ? EMPTY : fromPublishedKind(kind);
        }

        static TopologyKind fromPrepared(DungeonEditorPreparedFrameFacts.PreparedTopologyKind kind) {
            return kind == null ? EMPTY : TopologyKind.valueOf(kind.name());
        }

        static TopologyKind defaultKind() {
            return EMPTY;
        }

        @SuppressWarnings("PMD.CyclomaticComplexity")
        private static TopologyKind fromDomainKind(DungeonTopologyElementKind kind) {
            if (kind == DungeonTopologyElementKind.ROOM) {
                return ROOM;
            }
            if (kind == DungeonTopologyElementKind.CORRIDOR) {
                return CORRIDOR;
            }
            if (kind == DungeonTopologyElementKind.CORRIDOR_ANCHOR) {
                return CORRIDOR_ANCHOR;
            }
            if (kind == DungeonTopologyElementKind.DOOR) {
                return DOOR;
            }
            if (kind == DungeonTopologyElementKind.WALL) {
                return WALL;
            }
            if (kind == DungeonTopologyElementKind.STAIR) {
                return STAIR;
            }
            if (kind == DungeonTopologyElementKind.TRANSITION) {
                return TRANSITION;
            }
            if (kind == DungeonTopologyElementKind.FEATURE_MARKER) {
                return FEATURE_MARKER;
            }
            return EMPTY;
        }

        @SuppressWarnings("PMD.CyclomaticComplexity")
        private static TopologyKind fromPublishedKind(
                src.domain.dungeon.published.DungeonTopologyElementKind kind
        ) {
            if (kind == src.domain.dungeon.published.DungeonTopologyElementKind.ROOM) {
                return ROOM;
            }
            if (kind == src.domain.dungeon.published.DungeonTopologyElementKind.CORRIDOR) {
                return CORRIDOR;
            }
            if (kind == src.domain.dungeon.published.DungeonTopologyElementKind.CORRIDOR_ANCHOR) {
                return CORRIDOR_ANCHOR;
            }
            if (kind == src.domain.dungeon.published.DungeonTopologyElementKind.DOOR) {
                return DOOR;
            }
            if (kind == src.domain.dungeon.published.DungeonTopologyElementKind.WALL) {
                return WALL;
            }
            if (kind == src.domain.dungeon.published.DungeonTopologyElementKind.STAIR) {
                return STAIR;
            }
            if (kind == src.domain.dungeon.published.DungeonTopologyElementKind.TRANSITION) {
                return TRANSITION;
            }
            if (kind == src.domain.dungeon.published.DungeonTopologyElementKind.FEATURE_MARKER) {
                return FEATURE_MARKER;
            }
            return EMPTY;
        }

        DungeonTopologyElementKind domainKind() {
            return switch (this) {
                case ROOM -> DungeonTopologyElementKind.ROOM;
                case CORRIDOR -> DungeonTopologyElementKind.CORRIDOR;
                case CORRIDOR_ANCHOR -> DungeonTopologyElementKind.CORRIDOR_ANCHOR;
                case DOOR -> DungeonTopologyElementKind.DOOR;
                case WALL -> DungeonTopologyElementKind.WALL;
                case STAIR -> DungeonTopologyElementKind.STAIR;
                case TRANSITION -> DungeonTopologyElementKind.TRANSITION;
                case FEATURE_MARKER -> DungeonTopologyElementKind.FEATURE_MARKER;
                default -> DungeonTopologyElementKind.EMPTY;
            };
        }

        DungeonTopologyRef ref(long id) {
            return new DungeonTopologyRef(domainKind(), Math.max(EMPTY_ID, id));
        }

        boolean isEmpty() {
            return this == EMPTY;
        }

        boolean isRoom() {
            return this == ROOM;
        }

        boolean isDoor() {
            return this == DOOR;
        }

        boolean isCorridor() {
            return domainKind().isCorridor();
        }

        boolean syntheticCellHover(long ownerId, long topologyId) {
            return ownerId == EMPTY_ID && (isEmpty() || topologyId == EMPTY_ID);
        }

        String stableName() {
            return this == EMPTY ? "" : name();
        }
    }

    public enum BoundaryKind {
        WALL,
        DOOR;

        static BoundaryKind defaultKind() {
            return WALL;
        }

        static BoundaryKind fromPrepared(DungeonEditorPreparedFrameFacts.PreparedBoundaryKind kind) {
            return kind == null ? WALL : BoundaryKind.valueOf(kind.name());
        }

        boolean isDoor() {
            return this == DOOR;
        }

        String stableName() {
            return name();
        }
    }

    public enum SyntheticHoverKind {
        NONE,
        CELL,
        BOUNDARY,
        VERTEX;

        static SyntheticHoverKind fromPrepared(DungeonEditorPreparedFrameFacts.PreparedSyntheticHoverKind kind) {
            return kind == null ? NONE : SyntheticHoverKind.valueOf(kind.name());
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
                    BoundaryKind.defaultKind(),
                    "",
                    0L,
                    TopologyKind.defaultKind(),
                    0L,
                    0.0,
                    0.0,
                    0,
                    0.0,
                    0.0,
                    0);
        }

        boolean hoverBoundary() {
            return key.startsWith("hover-boundary:");
        }
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
