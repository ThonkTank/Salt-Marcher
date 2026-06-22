package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;

public final class ApplyDungeonEditorHandleMutationUseCase {
    private static final long ABSENT_ID = 0L;

    private final ApplyDungeonEditorOperationUseCase operationUseCase;

    public ApplyDungeonEditorHandleMutationUseCase(ApplyDungeonEditorOperationUseCase operationUseCase) {
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applyDoorMove(
            @Nullable DungeonMapIdentity mapId,
            DoorHandleMove move
    ) {
        DoorHandleMove safeMove = Objects.requireNonNull(move, "move");
        return operationUseCase.execute(mapId, current -> {
            if (safeMove.stationary()) {
                return current;
            }
            if (safeMove.corridorId() > ABSENT_ID) {
                return current.moveDoorBinding(
                        safeMove.corridorId(),
                        safeMove.bindingIndex(),
                        safeMove.roomId(),
                        safeMove.deltaQ(),
                        safeMove.deltaR(),
                        safeMove.deltaLevel());
            }
            return current.moveDoorBoundary(
                    safeMove.topologyRef(),
                    safeMove.clusterId() > 0L
                            ? safeMove.clusterId()
                            : current.topologyIndex().clusterIdOrZero(safeMove.topologyRef()),
                    safeMove.roomId(),
                    safeMove.sourceEdge(),
                    safeMove.deltaQ(),
                    safeMove.deltaR(),
                    safeMove.deltaLevel());
        });
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applyCorridorAnchorMove(
            @Nullable DungeonMapIdentity mapId,
            CorridorAnchorMove move
    ) {
        CorridorAnchorMove safeMove = Objects.requireNonNull(move, "move");
        return operationUseCase.execute(mapId, current -> safeMove.stationary()
                ? current
                : current.moveCorridorAnchor(
                        safeMove.corridorId(),
                        safeMove.bindingIndex(),
                        safeMove.topologyRef(),
                        safeMove.deltaQ(),
                        safeMove.deltaR(),
                        safeMove.deltaLevel()));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applyCorridorWaypointMove(
            @Nullable DungeonMapIdentity mapId,
            CorridorWaypointMove move
    ) {
        CorridorWaypointMove safeMove = Objects.requireNonNull(move, "move");
        return operationUseCase.execute(mapId, current -> safeMove.stationary()
                ? current
                : current.moveCorridorWaypoint(
                        safeMove.corridorId(),
                        safeMove.waypointIndex(),
                        safeMove.deltaQ(),
                        safeMove.deltaR(),
                        safeMove.deltaLevel()));
    }

    public record DoorHandleMove(
            DungeonTopologyRef topologyRef,
            long clusterId,
            long corridorId,
            long roomId,
            int bindingIndex,
            Edge sourceEdge,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        public DoorHandleMove {
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            bindingIndex = Math.max(0, bindingIndex);
            sourceEdge = Objects.requireNonNull(sourceEdge, "sourceEdge");
        }

        private boolean stationary() {
            return deltaQ == 0 && deltaR == 0 && deltaLevel == 0;
        }
    }

    public record CorridorAnchorMove(
            DungeonTopologyRef topologyRef,
            long corridorId,
            int bindingIndex,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        public CorridorAnchorMove {
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            corridorId = Math.max(0L, corridorId);
            bindingIndex = Math.max(0, bindingIndex);
        }

        private boolean stationary() {
            return deltaQ == 0 && deltaR == 0 && deltaLevel == 0;
        }
    }

    public record CorridorWaypointMove(
            long corridorId,
            int waypointIndex,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        public CorridorWaypointMove {
            corridorId = Math.max(0L, corridorId);
            waypointIndex = Math.max(0, waypointIndex);
        }

        private boolean stationary() {
            return deltaQ == 0 && deltaR == 0 && deltaLevel == 0;
        }
    }
}
