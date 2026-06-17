package src.domain.dungeon.model.runtime.editor.interaction;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;

/**
 * Resolves editor handle movement into core-shaped aggregate mutations.
 */
public final class DungeonEditorHandleMutation {

    public DungeonMap apply(
            DungeonMap current,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (handle == null || stationary(deltaQ, deltaR, deltaLevel) || handle.kind().isUnknown()) {
            return current;
        }
        return applyActiveHandle(current, handle, deltaQ, deltaR, deltaLevel);
    }

    private static DungeonMap applyActiveHandle(
            DungeonMap current,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (roomHandle(handle)) {
            return applyRoomHandle(current, handle, deltaQ, deltaR, deltaLevel);
        }
        if (corridorHandle(handle)) {
            return applyCorridorHandle(current, handle, deltaQ, deltaR, deltaLevel);
        }
        return handle.kind().isStairAnchor()
                ? current.moveStairAnchor(handle.ownerId(), handle.index(), deltaQ, deltaR, deltaLevel)
                : current;
    }

    private static DungeonMap applyRoomHandle(
            DungeonMap current,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (handle.kind().isClusterCorner()) {
            return current.moveClusterCorner(
                    clusterId(current, handle),
                    handle.cell(),
                    deltaQ,
                    deltaR,
                    deltaLevel);
        }
        if (handle.kind().isClusterWallRun()) {
            return current.moveBoundaryStretch(
                    clusterId(current, handle),
                    java.util.List.of(sourceEdge(handle)),
                    deltaQ,
                    deltaR,
                    deltaLevel);
        }
        return handle.kind().isClusterLabel()
                ? current.moveCluster(clusterId(current, handle), deltaQ, deltaR, deltaLevel)
                : current;
    }

    private static DungeonMap applyCorridorHandle(
            DungeonMap current,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (handle.kind().isDoor()) {
            return handle.corridorId() > 0L
                    ? current.moveDoorBinding(
                            handle.corridorId(),
                            handle.index(),
                            handle.roomId(),
                            deltaQ,
                            deltaR,
                            deltaLevel)
                    : current.moveDoorBoundary(
                            handle.topologyRef(),
                            clusterId(current, handle),
                            handle.roomId(),
                            sourceEdge(handle),
                            deltaQ,
                            deltaR,
                            deltaLevel);
        }
        if (handle.kind().isCorridorAnchor()) {
            return current.moveCorridorAnchor(
                    handle.corridorId(),
                    handle.index(),
                    handle.topologyRef(),
                    deltaQ,
                    deltaR,
                    deltaLevel);
        }
        return handle.kind().isCorridorWaypoint()
                ? current.moveCorridorWaypoint(handle.corridorId(), handle.index(), deltaQ, deltaR, deltaLevel)
                : current;
    }

    private static boolean roomHandle(DungeonEditorHandleMovement handle) {
        return handle.kind().isClusterCorner() || handle.kind().isClusterWallRun() || handle.kind().isClusterLabel();
    }

    private static boolean corridorHandle(DungeonEditorHandleMovement handle) {
        return handle.kind().isDoor()
                || handle.kind().isCorridorAnchor()
                || handle.kind().isCorridorWaypoint();
    }

    private static long clusterId(DungeonMap current, DungeonEditorHandleMovement handle) {
        return handle.clusterId() > 0L
                ? handle.clusterId()
                : current.topologyIndex().clusterIdOrZero(handle.topologyRef());
    }

    private static boolean stationary(int deltaQ, int deltaR, int deltaLevel) {
        return deltaQ == 0 && deltaR == 0 && deltaLevel == 0;
    }

    private static Cell safeCell(Cell cell) {
        return cell == null ? new Cell(0, 0, 0) : cell;
    }

    private static src.domain.dungeon.model.core.geometry.Edge sourceEdge(DungeonEditorHandleMovement handle) {
        return handle.sourceEdge() == null
                ? handle.direction().edgeOf(safeCell(handle.cell()))
                : handle.sourceEdge();
    }
}
