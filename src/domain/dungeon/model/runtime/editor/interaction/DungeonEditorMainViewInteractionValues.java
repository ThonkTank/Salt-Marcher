package src.domain.dungeon.model.runtime.editor.interaction;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.CellTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchOrientation;
import src.domain.dungeon.model.worldspace.DungeonEditorHandleType;
import src.domain.dungeon.model.worldspace.DungeonTopologyElementKind;
import src.domain.dungeon.model.worldspace.DungeonTopologyRef;

public final class DungeonEditorMainViewInteractionValues {

    public static final String CLUSTER_LABEL_KIND = "CLUSTER_LABEL";
    public static final String CLUSTER_CORNER_KIND = "CLUSTER_CORNER";
    public static final String CORRIDOR_ANCHOR_KIND = "CORRIDOR_ANCHOR";
    public static final String CORRIDOR_WAYPOINT_KIND = "CORRIDOR_WAYPOINT";
    public static final String DOOR_KIND = "DOOR";
    public static final String EMPTY_KIND = "EMPTY";
    public static final String ROOM_KIND = "ROOM";
    public static final String ROOM_PREFIX = "room:";
    public static final String WALL_KIND = "WALL";

    private DungeonEditorMainViewInteractionValues() {
    }

    public static DungeonTopologyElementKind toTopologyKind(@Nullable String kind) {
        return DungeonTopologyElementKind.valueOf(kind == null ? EMPTY_KIND : kind);
    }

    public record InteractionState(
            PaintSession paintSession,
            BoundaryDraft boundaryDraft,
            CorridorDraft corridorDraft,
            DragSession dragSession,
            BoundaryStretchSession boundaryStretchSession
    ) {
        public InteractionState {
            paintSession = paintSession == null ? PaintSession.none() : paintSession;
            boundaryDraft = boundaryDraft == null ? BoundaryDraft.none() : boundaryDraft;
            corridorDraft = corridorDraft == null ? CorridorDraft.none() : corridorDraft;
            dragSession = dragSession == null ? DragSession.none() : dragSession;
            boundaryStretchSession = boundaryStretchSession == null
                    ? BoundaryStretchSession.none()
                    : boundaryStretchSession;
        }

        public static InteractionState empty() {
            return new InteractionState(
                    PaintSession.none(),
                    BoundaryDraft.none(),
                    CorridorDraft.none(),
                    DragSession.none(),
                    BoundaryStretchSession.none());
        }

        public InteractionState clear() {
            return empty();
        }

        public InteractionState withPaintSession(PaintSession nextPaintSession) {
            return new InteractionState(nextPaintSession, boundaryDraft, corridorDraft, dragSession, boundaryStretchSession);
        }

        public InteractionState withBoundaryDraft(BoundaryDraft nextBoundaryDraft) {
            return new InteractionState(paintSession, nextBoundaryDraft, corridorDraft, dragSession, boundaryStretchSession);
        }

        public InteractionState withCorridorDraft(CorridorDraft nextCorridorDraft) {
            return new InteractionState(paintSession, boundaryDraft, nextCorridorDraft, dragSession, boundaryStretchSession);
        }

        public InteractionState withDragSession(DragSession nextDragSession) {
            return new InteractionState(paintSession, boundaryDraft, corridorDraft, nextDragSession, boundaryStretchSession);
        }

        public InteractionState withBoundaryStretchSession(BoundaryStretchSession nextBoundaryStretchSession) {
            return new InteractionState(paintSession, boundaryDraft, corridorDraft, dragSession, nextBoundaryStretchSession);
        }
    }

    public enum HitKind {
        EMPTY,
        HANDLE,
        LABEL,
        BOUNDARY,
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    public record HandleTarget(
            String kind,
            String topologyRefKind,
            long topologyRefId,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int orderIndex,
            CellTarget anchor,
            String direction
    ) {
        public HandleTarget {
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

        public static HandleTarget empty() {
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
                    "");
        }

        public static HandleTarget clusterLabel(String topologyRefKind, long topologyRefId, long ownerId, long clusterId) {
            return new HandleTarget(CLUSTER_LABEL_KIND, topologyRefKind, topologyRefId, ownerId, clusterId, 0L, 0L, 0, CellTarget.empty(), "");
        }

        public boolean clusterLabel() {
            return CLUSTER_LABEL_KIND.equals(kind);
        }

        public boolean clusterCorner() {
            return CLUSTER_CORNER_KIND.equals(kind);
        }

        public boolean corridorAnchor() {
            return CORRIDOR_ANCHOR_KIND.equals(kind);
        }

        public boolean corridorWaypoint() {
            return CORRIDOR_WAYPOINT_KIND.equals(kind);
        }

        public boolean doorHandle() {
            return DOOR_KIND.equals(kind);
        }

        public DungeonEditorWorkspaceValues.HandleRef toWorkspaceHandleRef() {
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
                    direction);
        }
    }

    public record BoundaryTarget(
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
        public BoundaryTarget {
            kind = kind == null || kind.isBlank() ? WALL_KIND : kind;
            key = key == null ? "" : key.strip();
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? EMPTY_KIND : topologyRefKind;
            topologyRefId = Math.max(0L, topologyRefId);
            start = start == null ? CellTarget.empty() : start;
            end = end == null ? CellTarget.empty() : end;
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget(false, WALL_KIND, "", 0L, 0L, EMPTY_KIND, 0L, CellTarget.empty(), CellTarget.empty());
        }

        public boolean doorKind() {
            return DOOR_KIND.equals(kind);
        }

        public DungeonEditorWorkspaceValues.Edge edgeRef() {
            return new DungeonEditorWorkspaceValues.Edge(start.toWorkspaceCell(), end.toWorkspaceCell());
        }
    }

    public record HitTarget(
            HitKind kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            HandleTarget handleRef,
            BoundaryTarget boundaryTarget
    ) {
        public HitTarget {
            kind = kind == null ? HitKind.EMPTY : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? EMPTY_KIND : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            handleRef = handleRef == null
                    ? HandleTarget.clusterLabel(topologyRefKind, topologyRefId, ownerId, clusterId)
                    : handleRef;
            boundaryTarget = boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget;
        }

        public static HitTarget empty() {
            return new HitTarget(HitKind.EMPTY, 0L, 0L, EMPTY_KIND, 0L, HandleTarget.empty(), BoundaryTarget.empty());
        }

        public boolean selectable() {
            return kind != HitKind.EMPTY && topologyRefId > 0L && !EMPTY_KIND.equals(topologyRefKind);
        }

        public boolean draggable() {
            return (kind == HitKind.HANDLE || kind == HitKind.LABEL)
                    && (clusterId > 0L || handleRef.ownerId() > 0L);
        }

        public boolean clusterSelection() {
            return kind == HitKind.LABEL || handleRef.clusterLabel() || handleRef.clusterCorner();
        }

        public DungeonEditorWorkspaceValues.HandleRef dragHandleRef() {
            if (kind == HitKind.HANDLE) {
                return handleRef.toWorkspaceHandleRef();
            }
            return HandleTarget.clusterLabel(topologyRefKind, topologyRefId, ownerId, clusterId).toWorkspaceHandleRef();
        }

        public DungeonEditorSessionValues.Selection toSelection() {
            return new DungeonEditorSessionValues.Selection(
                    new DungeonTopologyRef(toTopologyKind(topologyRefKind), topologyRefId),
                    clusterId,
                    clusterSelection(),
                    dragHandleRef());
        }
    }

    public record PointerState(
            int q,
            int r,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            HitTarget hitTarget,
            VertexTarget vertexTarget,
            BoundaryTarget boundaryTarget
    ) {
        public PointerState {
            hitTarget = hitTarget == null ? HitTarget.empty() : hitTarget;
            vertexTarget = vertexTarget == null ? VertexTarget.empty() : vertexTarget;
            boundaryTarget = boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget;
        }
    }

    public record PaintSession(
            int startQ,
            int startR,
            int endQ,
            int endR,
            int level,
            boolean deleteMode,
            boolean present
    ) {
        public static PaintSession none() {
            return new PaintSession(0, 0, 0, 0, 0, false, false);
        }

        public PaintSession withEnd(int nextEndQ, int nextEndR) {
            return new PaintSession(startQ, startR, nextEndQ, nextEndR, level, deleteMode, true);
        }

        public DungeonEditorSessionValues.RoomRectanglePreview preview() {
            return new DungeonEditorSessionValues.RoomRectanglePreview(
                    new DungeonEditorWorkspaceValues.Cell(startQ, startR, level),
                    new DungeonEditorWorkspaceValues.Cell(endQ, endR, level),
                    deleteMode);
        }
    }

    public record DragSession(
            DungeonEditorSessionValues.Selection selection,
            int pressQ,
            int pressR,
            int currentQ,
            int currentR,
            int pressLevel,
            int currentLevel,
            boolean present
    ) {
        public DragSession {
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
        }

        public static DragSession start(DungeonEditorSessionValues.Selection selection, int pressQ, int pressR, int pressLevel) {
            return new DragSession(selection, pressQ, pressR, pressQ, pressR, pressLevel, pressLevel, true);
        }

        public static DragSession none() {
            return new DragSession(DungeonEditorSessionValues.Selection.empty(), 0, 0, 0, 0, 0, 0, false);
        }

        public int deltaQ() {
            return currentQ - pressQ;
        }

        public int deltaR() {
            return currentR - pressR;
        }

        public int deltaLevel() {
            return currentLevel - pressLevel;
        }

        public boolean moved() {
            return deltaQ() != 0 || deltaR() != 0 || deltaLevel() != 0;
        }

        public DragSession withCurrentPointer(int nextQ, int nextR) {
            return new DragSession(selection, pressQ, pressR, nextQ, nextR, pressLevel, currentLevel, true);
        }

        public DragSession withCurrentLevel(int nextLevel) {
            return new DragSession(selection, pressQ, pressR, currentQ, currentR, pressLevel, nextLevel, true);
        }

        public DungeonEditorSessionValues.MoveHandlePreview moveHandlePreview() {
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

    public enum BoundaryStretchSide {
        NONE(false),
        INNER(false),
        OUTER(true);

        private final boolean outer;

        BoundaryStretchSide(boolean outer) {
            this.outer = outer;
        }

        public boolean outer() {
            return outer;
        }
    }

    public record BoundaryStretchSession(
            DungeonEditorSessionValues.Selection selection,
            long clusterId,
            List<DungeonEditorWorkspaceValues.Edge> sourceEdges,
            StretchOrientation orientation,
            int pressQ,
            int pressR,
            int pressLevel,
            int currentQ,
            int currentR,
            boolean present
    ) {
        public BoundaryStretchSession {
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
            orientation = orientation == null ? StretchOrientation.VERTICAL : orientation;
        }

        public static BoundaryStretchSession none() {
            return new BoundaryStretchSession(
                    DungeonEditorSessionValues.Selection.empty(),
                    0L,
                    List.of(),
                    StretchOrientation.VERTICAL,
                    0,
                    0,
                    0,
                    0,
                    0,
                    false);
        }

        public BoundaryStretchSession withCurrentPointer(int nextQ, int nextR) {
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

        public int deltaQ() {
            return orientation == StretchOrientation.VERTICAL ? currentQ - pressQ : 0;
        }

        public int deltaR() {
            return orientation == StretchOrientation.HORIZONTAL ? currentR - pressR : 0;
        }

        public int deltaLevel() {
            return 0;
        }

        public boolean moved() {
            return deltaQ() != 0 || deltaR() != 0;
        }

        public DungeonEditorSessionValues.MoveBoundaryStretchPreview preview() {
            return new DungeonEditorSessionValues.MoveBoundaryStretchPreview(
                    clusterId,
                    sourceEdges,
                    deltaQ(),
                    deltaR(),
                    deltaLevel());
        }
    }

    public record BoundaryDraft(
            long clusterId,
            boolean deleteMode,
            VertexKey startVertex,
            VertexKey currentVertex,
            Set<EdgeKey> previewEdges,
            boolean present
    ) {
        public BoundaryDraft {
            startVertex = startVertex == null ? new VertexKey(0, 0, 0) : startVertex;
            currentVertex = currentVertex == null ? new VertexKey(0, 0, 0) : currentVertex;
            previewEdges = previewEdges == null ? Set.of() : Set.copyOf(previewEdges);
        }

        public static BoundaryDraft none() {
            return new BoundaryDraft(0L, false, new VertexKey(0, 0, 0), new VertexKey(0, 0, 0), Set.of(), false);
        }
    }

    public record CorridorDraft(PendingCorridorTarget start, boolean present) {
        public CorridorDraft {
            start = copyPendingCorridorTarget(start == null ? PendingCorridorTarget.empty() : start);
        }

        @Override
        public PendingCorridorTarget start() {
            return copyPendingCorridorTarget(start);
        }

        public static CorridorDraft none() {
            return new CorridorDraft(PendingCorridorTarget.empty(), false);
        }

        public static CorridorDraft start(PendingCorridorTarget target) {
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

    public sealed interface PendingCorridorTarget permits PendingCorridorTarget.EndpointTarget {
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

    public record BoundaryRoomTouch(
            DungeonEditorWorkspaceValues.Area room,
            DungeonEditorWorkspaceValues.Cell roomCell
    ) {
        public BoundaryRoomTouch {
            Objects.requireNonNull(room);
            Objects.requireNonNull(roomCell);
        }
    }

    public record PathResult(List<EdgeKey> routeEdges, Set<EdgeKey> committedEdges) {
        public PathResult {
            routeEdges = routeEdges == null ? List.of() : List.copyOf(routeEdges);
            committedEdges = committedEdges == null ? Set.of() : Set.copyOf(committedEdges);
        }

        public static PathResult empty() {
            return new PathResult(List.of(), Set.of());
        }

        public boolean hasRoute() {
            return !routeEdges.isEmpty();
        }
    }

    public record EdgeKey(VertexKey start, VertexKey end) {
        public EdgeKey {
            Objects.requireNonNull(start);
            Objects.requireNonNull(end);
        }

        public static EdgeKey from(DungeonEditorWorkspaceValues.Edge edge) {
            return between(
                    new VertexKey(edge.from().q(), edge.from().r(), edge.from().level()),
                    new VertexKey(edge.to().q(), edge.to().r(), edge.to().level()));
        }

        public static EdgeKey between(VertexKey first, VertexKey second) {
            return VertexKey.order().compare(first, second) <= 0 ? new EdgeKey(first, second) : new EdgeKey(second, first);
        }

        public static EdgeKey sideOf(CellKey cell, TravelHeading direction) {
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

        public boolean touches(VertexKey vertex) {
            return start.equals(vertex) || end.equals(vertex);
        }

        public DungeonEditorWorkspaceValues.Edge toEdgeRef() {
            return new DungeonEditorWorkspaceValues.Edge(
                    new DungeonEditorWorkspaceValues.Cell(start.q(), start.r(), start.level()),
                    new DungeonEditorWorkspaceValues.Cell(end.q(), end.r(), end.level()));
        }
    }
}
