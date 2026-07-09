package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.corridor.CorridorDeletionTarget;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.corridor.CorridorMapAuthoring;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceCoreGeometry;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class ApplyDungeonEditorCorridorMutationUseCase {
    private static final CorridorMapAuthoring CORRIDOR_AUTHORING = new CorridorMapAuthoring();

    private final ApplyDungeonEditorOperationUseCase operationUseCase;
    private final DungeonMapRepository repository;

    public ApplyDungeonEditorCorridorMutationUseCase(
            ApplyDungeonEditorOperationUseCase operationUseCase,
            DungeonMapRepository repository
    ) {
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applyCreate(
            @Nullable DungeonMapIdentity mapId,
            DungeonEditorWorkspaceValues.CorridorEndpoint start,
            DungeonEditorWorkspaceValues.CorridorEndpoint end
    ) {
        DungeonCorridorEndpoint startEndpoint = corridorEndpoint(start);
        DungeonCorridorEndpoint endEndpoint = corridorEndpoint(end);
        return operationUseCase.execute(
                mapId,
                current -> current.createCorridor(
                        stairIdForCorridor(current, startEndpoint, endEndpoint, true),
                        startEndpoint,
                        endEndpoint));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData previewCreate(
            @Nullable DungeonMapIdentity mapId,
            DungeonEditorWorkspaceValues.CorridorEndpoint start,
            DungeonEditorWorkspaceValues.CorridorEndpoint end
    ) {
        DungeonCorridorEndpoint startEndpoint = corridorEndpoint(start);
        DungeonCorridorEndpoint endEndpoint = corridorEndpoint(end);
        return operationUseCase.preview(
                mapId,
                current -> current.createCorridor(
                        stairIdForCorridor(current, startEndpoint, endEndpoint, false),
                        startEndpoint,
                        endEndpoint));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData applyDelete(
            @Nullable DungeonMapIdentity mapId,
            CorridorDeletionTarget target
    ) {
        return operationUseCase.execute(
                mapId,
                current -> CORRIDOR_AUTHORING.deleteCorridor(current, target));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData previewDelete(
            @Nullable DungeonMapIdentity mapId,
            CorridorDeletionTarget target
    ) {
        return operationUseCase.preview(
                mapId,
                current -> CORRIDOR_AUTHORING.deleteCorridor(current, target));
    }

    private long stairIdForCorridor(
            DungeonMap current,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end,
            boolean reservePersistentIds
    ) {
        if (start.sameLevelAs(end)) {
            return 0L;
        }
        return reservePersistentIds ? repository.nextStairId() : nextPreviewStairId(current);
    }

    private static long nextPreviewStairId(DungeonMap current) {
        long highestStairId = 0L;
        for (Stair stair : current.stairs().stairs()) {
            highestStairId = Math.max(highestStairId, stair.stairId());
        }
        return highestStairId + 1L;
    }

    private static DungeonCorridorEndpoint corridorEndpoint(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door -> DungeonCorridorEndpoint.door(
                    door.roomId(),
                    door.clusterId(),
                    DungeonEditorWorkspaceCoreGeometry.cell(door.roomCell()),
                    Direction.parse(door.direction()),
                    door.topologyRef());
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor -> DungeonCorridorEndpoint.anchor(
                    anchor.hostCorridorId(),
                    DungeonEditorWorkspaceCoreGeometry.cell(anchor.anchorCell()),
                    anchor.topologyRef());
            case null -> DungeonCorridorEndpoint.door(
                    0L,
                    0L,
                    fallbackCorridorEndpointCell(),
                    Direction.NORTH,
                    DungeonTopologyRef.empty());
        };
    }

    private static Cell fallbackCorridorEndpointCell() {
        return new Cell(0, 0, 0);
    }
}
