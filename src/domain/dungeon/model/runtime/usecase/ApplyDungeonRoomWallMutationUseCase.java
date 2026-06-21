package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

public final class ApplyDungeonRoomWallMutationUseCase {
    private static final long MIN_CLUSTER_ID = 0L;

    private final ApplyDungeonEditorOperationUseCase operationUseCase;

    public ApplyDungeonRoomWallMutationUseCase(ApplyDungeonEditorOperationUseCase operationUseCase) {
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applyRoomRectangle(
            @Nullable DungeonMapIdentity mapId,
            RoomRectangleMutation room
    ) {
        return operationUseCase.execute(mapId, roomRectangleMutation(room));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData previewRoomRectangle(
            @Nullable DungeonMapIdentity mapId,
            RoomRectangleMutation room
    ) {
        return operationUseCase.preview(mapId, roomRectangleMutation(room));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applyClusterBoundaries(
            @Nullable DungeonMapIdentity mapId,
            ClusterBoundaryMutation boundaries
    ) {
        return operationUseCase.execute(mapId, clusterBoundaryMutation(boundaries));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData previewClusterBoundaries(
            @Nullable DungeonMapIdentity mapId,
            ClusterBoundaryMutation boundaries
    ) {
        return operationUseCase.preview(mapId, clusterBoundaryMutation(boundaries));
    }

    private static ApplyDungeonEditorOperationUseCase.Mutation roomRectangleMutation(
            RoomRectangleMutation room
    ) {
        RoomRectangleMutation safeRoom = Objects.requireNonNull(room, "room");
        return safeRoom.deleteMode()
                ? current -> current.deleteRoomRectangle(safeRoom.start(), safeRoom.end())
                : current -> current.paintRoomRectangle(safeRoom.start(), safeRoom.end());
    }

    private static ApplyDungeonEditorOperationUseCase.Mutation clusterBoundaryMutation(
            ClusterBoundaryMutation boundaries
    ) {
        ClusterBoundaryMutation safeBoundaries = Objects.requireNonNull(boundaries, "boundaries");
        return current -> current.editClusterBoundaries(
                safeBoundaries.clusterId(),
                safeBoundaries.edges(),
                safeBoundaries.boundaryKind(),
                safeBoundaries.deleteMode());
    }

    public record RoomRectangleMutation(
            Cell start,
            Cell end,
            boolean deleteMode
    ) {
        public RoomRectangleMutation {
            start = Objects.requireNonNull(start, "start");
            end = Objects.requireNonNull(end, "end");
        }
    }

    public record ClusterBoundaryMutation(
            long clusterId,
            List<Edge> edges,
            BoundaryKind boundaryKind,
            boolean deleteMode
    ) {
        public ClusterBoundaryMutation {
            if (clusterId < MIN_CLUSTER_ID) {
                throw new IllegalArgumentException("clusterId must be non-negative");
            }
            edges = List.copyOf(Objects.requireNonNull(edges, "edges"));
            boundaryKind = Objects.requireNonNull(boundaryKind, "boundaryKind");
        }

        @Override
        public List<Edge> edges() {
            return List.copyOf(edges);
        }
    }
}
