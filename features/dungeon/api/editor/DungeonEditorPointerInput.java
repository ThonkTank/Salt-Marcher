package features.dungeon.api.editor;

import features.dungeon.api.DungeonEditorHandleRef;
import java.util.List;

/** Semantic canvas input derived from one consumed Editor state revision. */
public record DungeonEditorPointerInput(
        long sourceRevision,
        Action action,
        DungeonEditorToolSelection toolSelection,
        DungeonEditorPointerGesture gesture,
        double sceneX,
        double sceneY,
        List<Target> targets,
        int projectionLevel,
        DungeonEditorIntent.TransitionDestinationInput transitionDestination
) {
    public DungeonEditorPointerInput {
        sourceRevision = Math.max(0L, sourceRevision);
        action = action == null ? Action.MOVED : action;
        toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
        gesture = gesture == null ? DungeonEditorPointerGesture.none() : gesture;
        sceneX = Double.isFinite(sceneX) ? sceneX : 0.0;
        sceneY = Double.isFinite(sceneY) ? sceneY : 0.0;
        targets = targets == null ? List.of() : List.copyOf(targets);
        transitionDestination = transitionDestination == null
                ? DungeonEditorIntent.TransitionDestinationInput.empty()
                : transitionDestination;
    }

    public enum Action {
        PRESSED,
        DRAGGED,
        RELEASED,
        MOVED
    }

    public record Target(
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
        public Target {
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

        public static Target empty() {
            return new Target(TargetKind.EMPTY, LabelKind.EMPTY, ElementKind.EMPTY, 0L, 0L, TopologyKind.EMPTY, 0L,
                    DungeonEditorHandleRef.empty(), BoundaryTarget.empty(), SyntheticHoverKind.NONE,
                    CellTarget.empty(), VertexTarget.empty());
        }

        public static Target cell(ElementKind kind, long owner, long cluster, TopologyKind topology,
                long topologyId, int q, int r, int level) {
            return new Target(TargetKind.CELL, LabelKind.EMPTY, kind, owner, cluster, topology, topologyId,
                    DungeonEditorHandleRef.empty(), BoundaryTarget.empty(),
                    owner == 0L && (topology == TopologyKind.EMPTY || topologyId == 0L)
                            ? SyntheticHoverKind.CELL : SyntheticHoverKind.NONE,
                    new CellTarget(true, q, r, level), VertexTarget.empty());
        }
        public static Target syntheticCell(ElementKind kind, int q, int r, int level) {
            return cell(kind, 0L, 0L, TopologyKind.EMPTY, 0L, q, r, level);
        }
        public static Target label(LabelKind kind, long owner, long cluster, TopologyKind topology, long topologyId) {
            return new Target(TargetKind.LABEL, kind, ElementKind.fromTopology(topology), owner, cluster,
                    topology, topologyId, DungeonEditorHandleRef.empty(), BoundaryTarget.empty(),
                    SyntheticHoverKind.NONE, CellTarget.empty(), VertexTarget.empty());
        }
        public static Target marker(ElementKind kind, long owner, long cluster, TopologyKind topology, long topologyId) {
            return new Target(TargetKind.MARKER, LabelKind.EMPTY, kind, owner, cluster, topology, topologyId,
                    DungeonEditorHandleRef.empty(), BoundaryTarget.empty(), SyntheticHoverKind.NONE,
                    CellTarget.empty(), VertexTarget.empty());
        }
        public static Target graphNode(long owner, long cluster, TopologyKind topology, long topologyId) {
            return new Target(TargetKind.GRAPH_NODE, LabelKind.EMPTY, ElementKind.fromTopology(topology), owner,
                    cluster, topology, topologyId, DungeonEditorHandleRef.empty(), BoundaryTarget.empty(),
                    SyntheticHoverKind.NONE, CellTarget.empty(), VertexTarget.empty());
        }
        public static Target handle(DungeonEditorHandleRef ref) {
            DungeonEditorHandleRef safe = ref == null ? DungeonEditorHandleRef.empty() : ref;
            TopologyKind topology = TopologyKind.fromPublished(safe.topologyRef().kind());
            return new Target(TargetKind.HANDLE, LabelKind.EMPTY, ElementKind.fromTopology(topology),
                    safe.ownerId(), safe.clusterId(), topology, safe.topologyRef().id(), safe,
                    BoundaryTarget.empty(), SyntheticHoverKind.NONE, CellTarget.empty(), VertexTarget.empty());
        }
        public static Target boundary(BoundaryTarget value) {
            BoundaryTarget safe = value == null ? BoundaryTarget.empty() : value;
            return new Target(TargetKind.BOUNDARY, LabelKind.EMPTY, ElementKind.fromBoundary(safe.boundaryKind()),
                    safe.ownerId(), 0L, safe.topologyKind(), safe.topologyId(), DungeonEditorHandleRef.empty(), safe,
                    safe.hoverBoundary() ? SyntheticHoverKind.BOUNDARY : SyntheticHoverKind.NONE,
                    CellTarget.empty(), VertexTarget.empty());
        }
        public static Target vertex(int q, int r, int level) {
            return new Target(TargetKind.VERTEX, LabelKind.EMPTY, ElementKind.WALL_VERTEX, 0L, 0L,
                    TopologyKind.EMPTY, 0L, DungeonEditorHandleRef.empty(), BoundaryTarget.empty(),
                    SyntheticHoverKind.VERTEX, CellTarget.empty(), new VertexTarget(true, q, r, level));
        }
        public boolean hasSyntheticHover() { return syntheticHoverKind != SyntheticHoverKind.NONE; }
        public boolean isSyntheticCellHover() { return syntheticHoverKind == SyntheticHoverKind.CELL; }
        public boolean isCellTarget() { return targetKind == TargetKind.CELL; }
        public boolean isBoundaryTarget() { return targetKind == TargetKind.BOUNDARY; }
        public boolean isVertexTarget() { return targetKind == TargetKind.VERTEX; }
        public boolean isHandleTarget() { return targetKind == TargetKind.HANDLE; }
        public boolean isLabelTarget() { return targetKind == TargetKind.LABEL; }
        public boolean isMarkerTarget() { return targetKind == TargetKind.MARKER; }
        public boolean isGraphNodeTarget() { return targetKind == TargetKind.GRAPH_NODE && stableTopology(); }
        public boolean isRoomLabelTarget() { return labelKind == LabelKind.ROOM_LABEL; }
        public boolean isClusterLabelTarget() { return labelKind == LabelKind.CLUSTER_LABEL; }
        public boolean isSelectableLabelTarget() { return isLabelTarget() && isClusterLabelTarget(); }
        public boolean isSelectableCellTarget() { return isCellTarget() && stableTopology(); }
        public boolean isSelectableMarkerTarget() { return isMarkerTarget() && stableTopology(); }
        public boolean isDoorBoundaryTarget() { return isBoundaryTarget() && boundary.boundaryKind().isDoor(); }
        public boolean isCorridorCellTarget() { return isCellTarget() && elementKind == ElementKind.CORRIDOR; }
        public boolean hasTransitionElement() { return elementKind == ElementKind.TRANSITION; }
        public boolean hasRoomElement() { return elementKind == ElementKind.ROOM; }
        public boolean hasFeatureMarkerElement() { return elementKind == ElementKind.FEATURE_MARKER; }
        public boolean isWallOrDoorBoundaryTarget() { return isBoundaryTarget(); }
        private boolean stableTopology() { return topologyId > 0L && topologyKind != TopologyKind.EMPTY; }
        public int cellQ() { return cell.q(); } public int cellR() { return cell.r(); }
        public int cellLevel() { return cell.level(); } public int vertexQ() { return vertex.q(); }
        public int vertexR() { return vertex.r(); } public int vertexLevel() { return vertex.level(); }
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
            boundaryKind = boundaryKind == null ? BoundaryKind.WALL : boundaryKind;
            key = safeText(key);
            ownerId = Math.max(0L, ownerId);
            topologyKind = topologyKind == null ? TopologyKind.EMPTY : topologyKind;
            topologyId = Math.max(0L, topologyId);
            startQ = Double.isFinite(startQ) ? startQ : 0.0;
            startR = Double.isFinite(startR) ? startR : 0.0;
            endQ = Double.isFinite(endQ) ? endQ : 0.0;
            endR = Double.isFinite(endR) ? endR : 0.0;
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget(BoundaryKind.WALL, "", 0L, TopologyKind.EMPTY, 0L,
                    0.0, 0.0, 0, 0.0, 0.0, 0);
        }
        public boolean hoverBoundary() { return key.startsWith("hover-boundary:"); }
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

    public enum TargetKind {
        EMPTY, CELL, LABEL, MARKER, GRAPH_NODE, HANDLE, BOUNDARY, VERTEX
    }

    public enum LabelKind {
        EMPTY, ROOM_LABEL, CLUSTER_LABEL, FEATURE_LABEL;
        public static LabelKind defaultKind() { return EMPTY; }
    }

    public enum ElementKind {
        EMPTY, ROOM, CORRIDOR, CORRIDOR_ANCHOR, STAIR, TRANSITION,
        FEATURE_MARKER, FEATURE_OBJECT, FEATURE_ENCOUNTER, FEATURE_POI,
        WALL, DOOR, WALL_VERTEX;
        public static ElementKind fromTopology(TopologyKind kind) {
            return switch (kind == null ? TopologyKind.EMPTY : kind) {
                case ROOM -> ROOM; case CORRIDOR -> CORRIDOR; case CORRIDOR_ANCHOR -> CORRIDOR_ANCHOR;
                case STAIR -> STAIR; case TRANSITION -> TRANSITION; case FEATURE_MARKER -> FEATURE_MARKER;
                case DOOR -> DOOR; case WALL -> WALL; case EMPTY -> EMPTY;
            };
        }
        public static ElementKind fromBoundary(BoundaryKind kind) { return kind == BoundaryKind.DOOR ? DOOR : WALL; }
    }

    public enum TopologyKind {
        EMPTY, ROOM, CORRIDOR, CORRIDOR_ANCHOR, DOOR, WALL, STAIR, TRANSITION, FEATURE_MARKER;
        public static TopologyKind defaultKind() { return EMPTY; }
        public static TopologyKind fromPublished(features.dungeon.api.DungeonTopologyElementKind kind) {
            return switch (kind == null ? features.dungeon.api.DungeonTopologyElementKind.EMPTY : kind) {
                case ROOM -> ROOM; case CORRIDOR -> CORRIDOR; case CORRIDOR_ANCHOR -> CORRIDOR_ANCHOR;
                case DOOR -> DOOR; case WALL -> WALL; case STAIR -> STAIR; case TRANSITION -> TRANSITION;
                case FEATURE_MARKER -> FEATURE_MARKER; case EMPTY -> EMPTY;
            };
        }
        public boolean isEmpty() { return this == EMPTY; }
        public boolean isRoom() { return this == ROOM; }
        public boolean isDoor() { return this == DOOR; }
        public boolean isCorridor() { return this == CORRIDOR || this == CORRIDOR_ANCHOR; }
        public String stableName() { return this == EMPTY ? "" : name(); }
    }

    public enum BoundaryKind {
        WALL, DOOR;
        public static BoundaryKind defaultKind() { return WALL; }
        public boolean isDoor() { return this == DOOR; }
    }

    public enum SyntheticHoverKind {
        NONE, CELL, BOUNDARY, VERTEX
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
