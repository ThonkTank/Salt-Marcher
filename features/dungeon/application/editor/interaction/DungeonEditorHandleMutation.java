package features.dungeon.application.editor.interaction;

import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;

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

    private static boolean roomHandle(DungeonEditorHandleMovement handle) {
        return handle.kind().isClusterCorner() || handle.kind().isClusterWallRun() || handle.kind().isClusterLabel();
    }

    private static long clusterId(DungeonMap current, DungeonEditorHandleMovement handle) {
        return handle.clusterId() > 0L
                ? handle.clusterId()
                : current.clusterIdForTopologyRef(handle.topologyRef());
    }

    private static boolean stationary(int deltaQ, int deltaR, int deltaLevel) {
        return deltaQ == 0 && deltaR == 0 && deltaLevel == 0;
    }

    private static Cell safeCell(Cell cell) {
        return cell == null ? new Cell(0, 0, 0) : cell;
    }

    private static features.dungeon.domain.core.geometry.Edge sourceEdge(DungeonEditorHandleMovement handle) {
        return handle.sourceEdge() == null
                ? handle.direction().edgeOf(safeCell(handle.cell()))
                : handle.sourceEdge();
    }
}
