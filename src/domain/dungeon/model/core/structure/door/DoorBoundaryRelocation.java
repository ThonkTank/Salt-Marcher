package src.domain.dungeon.model.core.structure.door;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingState;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

/**
 * Keeps authored door boundary geometry aligned with moved corridor door bindings.
 */
public final class DoorBoundaryRelocation {
    private static final DoorBoundaryMoveMaterialization MOVE_MATERIALIZATION =
            new DoorBoundaryMoveMaterialization();
    private static final DoorBoundaryMovedCluster MOVED_CLUSTER = new DoorBoundaryMovedCluster();

    public @Nullable DoorBoundaryMovePlan planMovedDoorBinding(
            DungeonMap sourceMap,
            CorridorDoorBindingState oldBinding,
            CorridorDoorBindingState newBinding
    ) {
        DungeonMap safeSourceMap = Objects.requireNonNull(sourceMap, "sourceMap");
        DoorBindingMoveContext context = DoorBindingMoveContext.from(safeSourceMap, oldBinding, newBinding);
        if (context == null || !MOVE_MATERIALIZATION.targetMaterializesDoor(safeSourceMap, context)) {
            return null;
        }
        DungeonRoomCluster movedCluster = MOVED_CLUSTER.movedCluster(context);
        if (movedCluster.equals(context.targetCluster())) {
            return null;
        }
        return new DoorBoundaryMovePlan(context.targetCluster().clusterId(), movedCluster);
    }

    public @Nullable DoorBoundaryMovePlan planMovedStandaloneDoorBoundary(
            DungeonMap sourceMap,
            DungeonTopologyRef topologyRef,
            long clusterId,
            long roomId,
            Edge sourceEdge,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        DungeonMap safeSourceMap = Objects.requireNonNull(sourceMap, "sourceMap");
        DoorBoundaryRelocationSupport.StandaloneMoveContext context =
                DoorBoundaryRelocationSupport.standaloneMoveContext(
                        safeSourceMap,
                        topologyRef,
                        clusterId,
                        roomId,
                        sourceEdge,
                        new DoorBoundaryRelocationSupport.MovementDelta(deltaQ, deltaR, deltaLevel));
        if (context == null) {
            return null;
        }
        if (!DoorBoundaryRelocationGeometry.targetMaterializesDoor(
                safeSourceMap,
                context.targetCluster(),
                context.nextDoorEdge(),
                DoorBoundaryRelocationGeometry.boundaryAt(context.targetCluster(), context.nextDoorEdge()))) {
            return null;
        }
        DungeonRoomCluster movedCluster = MOVED_CLUSTER.movedStandaloneDoor(
                context.targetCluster(),
                context.oldDoorBoundary(),
                context.nextDoorEdge(),
                context.expectedTopologyRef(),
                DoorBoundaryRelocationGeometry.roomsInCluster(safeSourceMap, context.targetCluster().clusterId()));
        if (movedCluster.equals(context.targetCluster())) {
            return null;
        }
        return new DoorBoundaryMovePlan(context.targetCluster().clusterId(), movedCluster);
    }

    public SpatialTopology relocateMovedDoorBinding(
            DungeonMap sourceMap,
            DoorBoundaryMovePlan plan
    ) {
        DungeonMap safeSourceMap = Objects.requireNonNull(sourceMap, "sourceMap");
        DoorBoundaryMovePlan safePlan = Objects.requireNonNull(plan, "plan");
        List<DungeonRoomCluster> nextClusters = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoomCluster candidate : safeSourceMap.topology().roomClusters()) {
            if (candidate.clusterId() == safePlan.clusterId()) {
                nextClusters.add(safePlan.movedCluster());
                changed = true;
            } else {
                nextClusters.add(candidate);
            }
        }
        return changed
                ? safeSourceMap.topology().withRoomClusters(nextClusters)
                : safeSourceMap.topology();
    }

    public record DoorBoundaryMovePlan(
            long clusterId,
            DungeonRoomCluster movedCluster
    ) {
        public DoorBoundaryMovePlan {
            movedCluster = Objects.requireNonNull(movedCluster, "movedCluster");
        }
    }
}
