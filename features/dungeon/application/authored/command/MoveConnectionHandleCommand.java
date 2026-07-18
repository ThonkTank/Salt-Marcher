package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMap;
import java.util.function.UnaryOperator;

/** Plans exact patches for authored cluster, door, corridor, and stair handle moves. */
public final class MoveConnectionHandleCommand {

    public DungeonCommandResult planCluster(
            DungeonMap current,
            long clusterId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (current == null || clusterId <= 0L) {
            return invalidTarget();
        }
        return plan(current, map -> map.moveCluster(clusterId, deltaQ, deltaR, deltaLevel));
    }

    public DungeonCommandResult planDoorBinding(
            DungeonMap current,
            long corridorId,
            int bindingIndex,
            long roomId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (current == null || corridorId <= 0L || bindingIndex < 0) {
            return invalidTarget();
        }
        return plan(current, map -> map.moveDoorBinding(
                corridorId,
                bindingIndex,
                Math.max(0L, roomId),
                deltaQ,
                deltaR,
                deltaLevel));
    }

    public DungeonCommandResult planDoorBoundary(
            DungeonMap current,
            DungeonTopologyRef topologyRef,
            long clusterId,
            long roomId,
            Edge sourceEdge,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (current == null || topologyRef == null || clusterId <= 0L || sourceEdge == null) {
            return invalidTarget();
        }
        return plan(current, map -> map.moveDoorBoundary(
                topologyRef,
                clusterId,
                Math.max(0L, roomId),
                sourceEdge,
                deltaQ,
                deltaR,
                deltaLevel));
    }

    public DungeonCommandResult planCorridorAnchor(
            DungeonMap current,
            long corridorId,
            int bindingIndex,
            DungeonTopologyRef topologyRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (current == null || corridorId <= 0L || bindingIndex < 0 || topologyRef == null) {
            return invalidTarget();
        }
        return plan(current, map -> map.moveCorridorAnchor(
                corridorId,
                bindingIndex,
                topologyRef,
                deltaQ,
                deltaR,
                deltaLevel));
    }

    public DungeonCommandResult planCorridorWaypoint(
            DungeonMap current,
            long corridorId,
            int waypointIndex,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (current == null || corridorId <= 0L || waypointIndex < 0) {
            return invalidTarget();
        }
        return plan(current, map -> map.moveCorridorWaypoint(
                corridorId,
                waypointIndex,
                deltaQ,
                deltaR,
                deltaLevel));
    }

    public DungeonCommandResult planStairAnchor(
            DungeonMap current,
            long stairId,
            int handleIndex,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (current == null || stairId <= 0L || handleIndex < 0) {
            return invalidTarget();
        }
        return plan(current, map -> map.moveStairAnchor(
                stairId,
                handleIndex,
                deltaQ,
                deltaR,
                deltaLevel));
    }

    private static DungeonCommandResult plan(
            DungeonMap current,
            UnaryOperator<DungeonMap> operation
    ) {
        return ConnectionPatchPlanner.plan(
                current,
                operation,
                DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
    }

    private static DungeonCommandResult invalidTarget() {
        return new DungeonCommandResult.Rejected(
                DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
    }
}
