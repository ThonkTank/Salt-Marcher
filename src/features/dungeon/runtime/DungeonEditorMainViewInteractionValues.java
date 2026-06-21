package src.features.dungeon.runtime;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.BoundaryStretchOrientation;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.CellKey;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.CellTarget;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.TravelHeading;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexKey;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexTarget;

final class DungeonEditorMainViewInteractionValues {

    static final String CLUSTER_LABEL_KIND = "CLUSTER_LABEL";
    static final String ROOM_LABEL_KIND = "ROOM_LABEL";
    static final String CLUSTER_CORNER_KIND = "CLUSTER_CORNER";
    static final String CLUSTER_WALL_RUN_KIND = "CLUSTER_WALL_RUN";
    static final String CORRIDOR_ANCHOR_KIND = "CORRIDOR_ANCHOR";
    static final String CORRIDOR_WAYPOINT_KIND = "CORRIDOR_WAYPOINT";
    static final String DOOR_KIND = "DOOR";
    static final String EMPTY_KIND = "EMPTY";
    static final String ROOM_KIND = "ROOM";
    static final String ROOM_PREFIX = "room:";
    static final String WALL_KIND = "WALL";

    private DungeonEditorMainViewInteractionValues() {
    }

    static DungeonTopologyElementKind toTopologyKind(@Nullable String kind) {
        return DungeonTopologyElementKind.valueOf(kind == null ? EMPTY_KIND : kind);
    }

    static String roomTargetKey(long roomId) {
        return ROOM_PREFIX + roomId;
    }

    static String doorTargetKey(long roomId, long doorId) {
        return roomTargetKey(roomId) + ":door:" + doorId;
    }

    record InteractionState(
            PaintSession paintSession,
            BoundaryDraft boundaryDraft,
            CorridorDraft corridorDraft,
            DragSession dragSession,
            BoundaryStretchSession boundaryStretchSession
    ) {
        InteractionState {
            paintSession = paintSession == null ? PaintSession.none() : paintSession;
            boundaryDraft = boundaryDraft == null ? BoundaryDraft.none() : boundaryDraft;
            corridorDraft = corridorDraft == null ? CorridorDraft.none() : corridorDraft;
            dragSession = dragSession == null ? DragSession.none() : dragSession;
            boundaryStretchSession = boundaryStretchSession == null
                    ? BoundaryStretchSession.none()
                    : boundaryStretchSession;
        }

        static InteractionState empty() {
            return new InteractionState(
                    PaintSession.none(),
                    BoundaryDraft.none(),
                    CorridorDraft.none(),
                    DragSession.none(),
                    BoundaryStretchSession.none());
        }

        InteractionState clear() {
            return empty();
        }

        InteractionState withPaintSession(PaintSession nextPaintSession) {
            return new InteractionState(nextPaintSession, boundaryDraft, corridorDraft, dragSession, boundaryStretchSession);
        }

        InteractionState withBoundaryDraft(BoundaryDraft nextBoundaryDraft) {
            return new InteractionState(paintSession, nextBoundaryDraft, corridorDraft, dragSession, boundaryStretchSession);
        }

        InteractionState withCorridorDraft(CorridorDraft nextCorridorDraft) {
            return new InteractionState(paintSession, boundaryDraft, nextCorridorDraft, dragSession, boundaryStretchSession);
        }

        InteractionState withDragSession(DragSession nextDragSession) {
            return new InteractionState(paintSession, boundaryDraft, corridorDraft, nextDragSession, boundaryStretchSession);
        }

        InteractionState withBoundaryStretchSession(BoundaryStretchSession nextBoundaryStretchSession) {
            return new InteractionState(paintSession, boundaryDraft, corridorDraft, dragSession, nextBoundaryStretchSession);
        }
    }

    enum HitKind {
        EMPTY,
        HANDLE,
        LABEL,
        BOUNDARY,
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    record HandleTarget(
            String kind,
            String topologyRefKind,
            long topologyRefId,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int orderIndex,
            CellTarget anchor,
            String direction,
            DungeonEditorWorkspaceValues.Edge sourceEdge
    ) {
        HandleTarget {
            kind = kind == null || kind.isBlank() ? CLUSTER_LABEL_KIND : kind;
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? EMPTY_KIND : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            orderIndex = Math.max(0, orderIndex);
            anchor = anchor == null ? CellTarget.empty() : anchor;
            direction = direction == null ? "" : direction;
        }

        static HandleTarget empty() {
            return new HandleTarget(
                    CLUSTER_LABEL_KIND,
                    EMPTY_KIND,
                    0L,
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    CellTarget.empty(),
                    "",
                    null);
        }

        static HandleTarget clusterLabel(String topologyRefKind, long topologyRefId, long ownerId, long clusterId) {
            return new HandleTarget(
                    CLUSTER_LABEL_KIND,
                    topologyRefKind,
                    topologyRefId,
                    ownerId,
                    clusterId,
                    0L,
                    0L,
                    0,
                    CellTarget.empty(),
                    "",
                    null);
        }

        boolean clusterLabel() {
            return CLUSTER_LABEL_KIND.equals(kind);
        }

        boolean clusterCorner() {
            return CLUSTER_CORNER_KIND.equals(kind);
        }

        boolean clusterWallRun() {
            return CLUSTER_WALL_RUN_KIND.equals(kind);
        }

        boolean corridorAnchor() {
            return CORRIDOR_ANCHOR_KIND.equals(kind);
        }

        boolean corridorWaypoint() {
            return CORRIDOR_WAYPOINT_KIND.equals(kind);
        }

        boolean doorHandle() {
            return DOOR_KIND.equals(kind);
        }

        DungeonEditorWorkspaceValues.HandleRef toWorkspaceHandleRef() {
            return new DungeonEditorWorkspaceValues.HandleRef(
                    DungeonEditorHandleType.valueOf(kind),
                    new DungeonTopologyRef(
                            toTopologyKind(topologyRefKind),
                            topologyRefId),
                    ownerId,
                    clusterId,
                    corridorId,
                    roomId,
                    orderIndex,
                    anchor.toWorkspaceCell(),
                    direction,
                    sourceEdge);
        }
    }

    record BoundaryTarget(
            boolean present,
            String kind,
            String key,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            CellTarget start,
            CellTarget end
    ) {
        BoundaryTarget {
            kind = kind == null || kind.isBlank() ? WALL_KIND : kind;
            key = key == null ? "" : key.strip();
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? EMPTY_KIND : topologyRefKind;
            topologyRefId = Math.max(0L, topologyRefId);
            start = start == null ? CellTarget.empty() : start;
            end = end == null ? CellTarget.empty() : end;
        }

        static BoundaryTarget empty() {
            return new BoundaryTarget(false, WALL_KIND, "", 0L, 0L, EMPTY_KIND, 0L, CellTarget.empty(), CellTarget.empty());
        }

        boolean doorKind() {
            return DOOR_KIND.equals(kind);
        }

        DungeonEditorWorkspaceValues.Edge edgeRef() {
            return new DungeonEditorWorkspaceValues.Edge(start.toWorkspaceCell(), end.toWorkspaceCell());
        }
    }

    record HitTarget(
            HitKind kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            String labelKind,
            HandleTarget handleRef,
            BoundaryTarget boundaryTarget
    ) {
        HitTarget {
            kind = kind == null ? HitKind.EMPTY : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? EMPTY_KIND : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            labelKind = labelKind == null || labelKind.isBlank() ? EMPTY_KIND : labelKind.trim();
            handleRef = handleRef == null ? HandleTarget.empty() : handleRef;
            boundaryTarget = boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget;
        }

        static HitTarget empty() {
            return new HitTarget(
                    HitKind.EMPTY,
                    0L,
                    0L,
                    EMPTY_KIND,
                    0L,
                    EMPTY_KIND,
                    HandleTarget.empty(),
                    BoundaryTarget.empty());
        }

        boolean selectable() {
            return kind != HitKind.EMPTY && topologyRefId > 0L && !EMPTY_KIND.equals(topologyRefKind);
        }

        boolean draggable() {
            return ((kind == HitKind.HANDLE && !handleRef.clusterWallRun()) || clusterLabelTarget())
                    && (clusterId > 0L || handleRef.ownerId() > 0L);
        }

        boolean clusterSelection() {
            return clusterLabelTarget()
                    || (kind == HitKind.HANDLE
                            && (handleRef.clusterLabel()
                                    || handleRef.clusterCorner()
                                    || handleRef.clusterWallRun()));
        }

        DungeonEditorWorkspaceValues.HandleRef dragHandleRef() {
            if (kind == HitKind.HANDLE) {
                return handleRef.toWorkspaceHandleRef();
            }
            if (!clusterLabelTarget()) {
                return DungeonEditorSessionValues.emptyHandleRef();
            }
            return HandleTarget.clusterLabel(topologyRefKind, topologyRefId, ownerId, clusterId).toWorkspaceHandleRef();
        }

        private boolean clusterLabelTarget() {
            return kind == HitKind.LABEL && CLUSTER_LABEL_KIND.equals(labelKind);
        }

        DungeonEditorSessionValues.Selection toSelection() {
            return new DungeonEditorSessionValues.Selection(
                    new DungeonTopologyRef(toTopologyKind(topologyRefKind), topologyRefId),
                    clusterId,
                    clusterSelection(),
                    dragHandleRef());
        }
    }

    record PointerState(
            int q,
            int r,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            boolean wallSingleClickMode,
            HitTarget hitTarget,
            VertexTarget vertexTarget,
            BoundaryTarget boundaryTarget
    ) {
        PointerState {
            hitTarget = hitTarget == null ? HitTarget.empty() : hitTarget;
            vertexTarget = vertexTarget == null ? VertexTarget.empty() : vertexTarget;
            boundaryTarget = boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget;
        }
    }

    record PaintSession(
            int startQ,
            int startR,
            int endQ,
            int endR,
            int level,
            boolean deleteMode,
            boolean present
    ) {
        static PaintSession none() {
            return new PaintSession(0, 0, 0, 0, 0, false, false);
        }

        PaintSession withEnd(int nextEndQ, int nextEndR) {
            return new PaintSession(startQ, startR, nextEndQ, nextEndR, level, deleteMode, true);
        }

        DungeonEditorSessionValues.RoomRectanglePreview preview() {
            return new DungeonEditorSessionValues.RoomRectanglePreview(
                    new DungeonEditorWorkspaceValues.Cell(startQ, startR, level),
                    new DungeonEditorWorkspaceValues.Cell(endQ, endR, level),
                    deleteMode);
        }
    }

    record DragSession(
            DungeonEditorSessionValues.Selection selection,
            int pressQ,
            int pressR,
            int currentQ,
            int currentR,
            int pressLevel,
            int currentLevel,
            boolean present
    ) {
        DragSession {
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
        }

        static DragSession start(DungeonEditorSessionValues.Selection selection, int pressQ, int pressR, int pressLevel) {
            return new DragSession(selection, pressQ, pressR, pressQ, pressR, pressLevel, pressLevel, true);
        }

        static DragSession none() {
            return new DragSession(DungeonEditorSessionValues.Selection.empty(), 0, 0, 0, 0, 0, 0, false);
        }

        int deltaQ() {
            return currentQ - pressQ;
        }

        int deltaR() {
            return currentR - pressR;
        }

        int deltaLevel() {
            return currentLevel - pressLevel;
        }

        boolean moved() {
            return deltaQ() != 0 || deltaR() != 0 || deltaLevel() != 0;
        }

        DragSession withCurrentPointer(int nextQ, int nextR) {
            return new DragSession(selection, pressQ, pressR, nextQ, nextR, pressLevel, currentLevel, true);
        }

        DragSession withCurrentLevel(int nextLevel) {
            return new DragSession(selection, pressQ, pressR, currentQ, currentR, pressLevel, nextLevel, true);
        }

        DungeonEditorSessionValues.MoveHandlePreview moveHandlePreview() {
            return new DungeonEditorSessionValues.MoveHandlePreview(handleRef(), deltaQ(), deltaR(), deltaLevel());
        }

        private DungeonEditorWorkspaceValues.HandleRef handleRef() {
            if (!selection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef())) {
                return selection.handleRef();
            }
            return new DungeonEditorWorkspaceValues.HandleRef(
                    DungeonEditorHandleType.CLUSTER_LABEL,
                    new DungeonTopologyRef(
                            selection.topologyRef().kind(),
                            selection.topologyRef().id()),
                    0L,
                    selection.clusterId(),
                    0L,
                    0L,
                    0,
                    DungeonEditorWorkspaceValues.Cell.empty(),
                    "");
        }
    }

    enum BoundaryStretchSide {
        NONE(false),
        INNER(false),
        OUTER(true);

        private final boolean outer;

        BoundaryStretchSide(boolean outer) {
            this.outer = outer;
        }

        boolean outer() {
            return outer;
        }
    }

    record BoundaryStretchSession(
            DungeonEditorSessionValues.Selection selection,
            long clusterId,
            List<DungeonEditorWorkspaceValues.Edge> sourceEdges,
            BoundaryStretchOrientation orientation,
            int pressQ,
            int pressR,
            int pressLevel,
            int currentQ,
            int currentR,
            boolean present
    ) {
        BoundaryStretchSession {
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
            orientation = orientation == null ? BoundaryStretchOrientation.VERTICAL : orientation;
        }

        static BoundaryStretchSession none() {
            return new BoundaryStretchSession(
                    DungeonEditorSessionValues.Selection.empty(),
                    0L,
                    List.of(),
                    BoundaryStretchOrientation.VERTICAL,
                    0,
                    0,
                    0,
                    0,
                    0,
                    false);
        }

        BoundaryStretchSession withCurrentPointer(int nextQ, int nextR) {
            return new BoundaryStretchSession(
                    selection,
                    clusterId,
                    sourceEdges,
                    orientation,
                    pressQ,
                    pressR,
                    pressLevel,
                    nextQ,
                    nextR,
                    true);
        }

        int deltaQ() {
            return orientation == BoundaryStretchOrientation.VERTICAL ? currentQ - pressQ : 0;
        }

        int deltaR() {
            return orientation == BoundaryStretchOrientation.HORIZONTAL ? currentR - pressR : 0;
        }

        int deltaLevel() {
            return 0;
        }

        boolean moved() {
            return deltaQ() != 0 || deltaR() != 0;
        }

        DungeonEditorSessionValues.MoveBoundaryStretchPreview preview() {
            return new DungeonEditorSessionValues.MoveBoundaryStretchPreview(
                    clusterId,
                    sourceEdges,
                    deltaQ(),
                    deltaR(),
                    deltaLevel());
        }
    }

    record BoundaryDraft(
            long clusterId,
            boolean deleteMode,
            VertexKey startVertex,
            VertexKey currentVertex,
            Set<EdgeKey> previewEdges,
            boolean present
    ) {
        BoundaryDraft {
            startVertex = startVertex == null ? new VertexKey(0, 0, 0) : startVertex;
            currentVertex = currentVertex == null ? new VertexKey(0, 0, 0) : currentVertex;
            previewEdges = copyEdges(previewEdges);
        }

        static BoundaryDraft none() {
            return new BoundaryDraft(0L, false, new VertexKey(0, 0, 0), new VertexKey(0, 0, 0), Set.of(), false);
        }

        static BoundaryDraft start(
                long clusterId,
                boolean deleteMode,
                VertexKey vertex
        ) {
            return new BoundaryDraft(clusterId, deleteMode, vertex, vertex, Set.of(), true);
        }

        BoundaryDraft advancedTo(
                VertexKey nextVertex,
                Set<EdgeKey> committedEdges
        ) {
            Set<EdgeKey> nextEdges = withAdditionalEdges(committedEdges);
            return new BoundaryDraft(clusterId, deleteMode, startVertex, nextVertex, nextEdges, true);
        }

        BoundaryDraft completedAt(
                VertexKey nextVertex,
                Set<EdgeKey> committedEdges
        ) {
            Set<EdgeKey> nextEdges = withAdditionalEdges(committedEdges);
            return new BoundaryDraft(clusterId, deleteMode, startVertex, nextVertex, nextEdges, true);
        }

        Set<EdgeKey> completionCandidate(Set<EdgeKey> committedEdges) {
            return withAdditionalEdges(committedEdges);
        }

        @Override
        public Set<EdgeKey> previewEdges() {
            return copyEdges(previewEdges);
        }

        private Set<EdgeKey> withAdditionalEdges(Set<EdgeKey> committedEdges) {
            Set<EdgeKey> nextEdges = new LinkedHashSet<>(previewEdges);
            if (committedEdges != null) {
                nextEdges.addAll(committedEdges);
            }
            return copyEdges(nextEdges);
        }

        private static Set<EdgeKey> copyEdges(Set<EdgeKey> source) {
            if (source == null || source.isEmpty()) {
                return Set.of();
            }
            return java.util.Collections.unmodifiableSet(new LinkedHashSet<>(source));
        }
    }

    record CorridorDraft(PendingCorridorTarget start, boolean present) {
        CorridorDraft {
            start = copyPendingCorridorTarget(start == null ? PendingCorridorTarget.empty() : start);
        }

        @Override
        public PendingCorridorTarget start() {
            return copyPendingCorridorTarget(start);
        }

        static CorridorDraft none() {
            return new CorridorDraft(PendingCorridorTarget.empty(), false);
        }

        static CorridorDraft start(PendingCorridorTarget target) {
            return new CorridorDraft(target, true);
        }

        private static PendingCorridorTarget copyPendingCorridorTarget(PendingCorridorTarget target) {
            if (target instanceof PendingCorridorTarget.EndpointTarget endpointTarget) {
                return new PendingCorridorTarget.EndpointTarget(
                        endpointTarget.targetKey(),
                        endpointTarget.displayLabel(),
                        endpointTarget.selection(),
                        endpointTarget.deleteCorridorId(),
                        endpointTarget.endpoint());
            }
            return PendingCorridorTarget.empty();
        }
    }

    sealed interface PendingCorridorTarget permits PendingCorridorTarget.EndpointTarget {
        String targetKey();

        String displayLabel();

        DungeonEditorSessionValues.Selection selection();

        long deleteCorridorId();

        DungeonEditorWorkspaceValues.CorridorEndpoint endpoint();

        static PendingCorridorTarget empty() {
            return new EndpointTarget(
                    "",
                    "",
                    DungeonEditorSessionValues.Selection.empty(),
                    0L,
                    new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                            0L,
                            DungeonEditorWorkspaceValues.Cell.empty(),
                            DungeonTopologyRef.empty()));
        }

        record EndpointTarget(
                String targetKey,
                String displayLabel,
                DungeonEditorSessionValues.Selection selection,
                long deleteCorridorId,
                DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
        ) implements PendingCorridorTarget {
            public EndpointTarget {
                targetKey = targetKey == null ? "" : targetKey;
                displayLabel = displayLabel == null ? "" : displayLabel;
                selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
                deleteCorridorId = Math.max(0L, deleteCorridorId);
                Objects.requireNonNull(endpoint);
            }
        }
    }

    record BoundaryRoomTouch(
            DungeonEditorWorkspaceValues.Area room,
            DungeonEditorWorkspaceValues.Cell roomCell
    ) {
        BoundaryRoomTouch {
            Objects.requireNonNull(room);
            Objects.requireNonNull(roomCell);
        }
    }

    record PathResult(List<EdgeKey> routeEdges, Set<EdgeKey> committedEdges) {
        PathResult {
            routeEdges = routeEdges == null ? List.of() : List.copyOf(routeEdges);
            committedEdges = committedEdges == null ? Set.of() : Set.copyOf(committedEdges);
        }

        static PathResult empty() {
            return new PathResult(List.of(), Set.of());
        }

        boolean hasRoute() {
            return !routeEdges.isEmpty();
        }
    }

    record EdgeKey(VertexKey start, VertexKey end) {
        EdgeKey {
            Objects.requireNonNull(start);
            Objects.requireNonNull(end);
        }

        static EdgeKey from(DungeonEditorWorkspaceValues.Edge edge) {
            return between(
                    new VertexKey(edge.from().q(), edge.from().r(), edge.from().level()),
                    new VertexKey(edge.to().q(), edge.to().r(), edge.to().level()));
        }

        static EdgeKey between(VertexKey first, VertexKey second) {
            return VertexKey.order().compare(first, second) <= 0 ? new EdgeKey(first, second) : new EdgeKey(second, first);
        }

        static EdgeKey sideOf(CellKey cell, TravelHeading direction) {
            if (direction == TravelHeading.NORTH) {
                return between(new VertexKey(cell.q(), cell.r(), cell.level()), new VertexKey(cell.q() + 1, cell.r(), cell.level()));
            }
            if (direction == TravelHeading.EAST) {
                return between(new VertexKey(cell.q() + 1, cell.r(), cell.level()), new VertexKey(cell.q() + 1, cell.r() + 1, cell.level()));
            }
            if (direction == TravelHeading.SOUTH) {
                return between(new VertexKey(cell.q(), cell.r() + 1, cell.level()), new VertexKey(cell.q() + 1, cell.r() + 1, cell.level()));
            }
            return between(new VertexKey(cell.q(), cell.r(), cell.level()), new VertexKey(cell.q(), cell.r() + 1, cell.level()));
        }

        boolean touches(VertexKey vertex) {
            return start.equals(vertex) || end.equals(vertex);
        }

        DungeonEditorWorkspaceValues.Edge toEdgeRef() {
            return new DungeonEditorWorkspaceValues.Edge(
                    new DungeonEditorWorkspaceValues.Cell(start.q(), start.r(), start.level()),
                    new DungeonEditorWorkspaceValues.Cell(end.q(), end.r(), end.level()));
        }
    }
}
