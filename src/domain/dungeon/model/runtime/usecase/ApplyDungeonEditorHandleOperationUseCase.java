package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceCoreGeometry;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;

public final class ApplyDungeonEditorHandleOperationUseCase {
    private final ApplyDungeonEditorHandleMutationUseCase handleMutationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public ApplyDungeonEditorHandleOperationUseCase(
            ApplyDungeonEditorHandleMutationUseCase handleMutationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.handleMutationUseCase = Objects.requireNonNull(handleMutationUseCase, "handleMutationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public void executeDoorHandleMove(
            MapId mapId,
            DungeonEditorSessionValues.MoveHandlePreview preview
    ) {
        DungeonEditorSessionValues.MoveHandlePreview safePreview =
                Objects.requireNonNull(preview, "preview");
        DungeonEditorWorkspaceValues.HandleRef handleRef = safePreview.handleRef();
        if (handleRef.kind() != DungeonEditorHandleType.DOOR) {
            return;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = handleMutationUseCase.applyDoorMove(
                domainMapId(mapId),
                new ApplyDungeonEditorHandleMutationUseCase.DoorHandleMove(
                        handleRef.topologyRef(),
                        handleRef.clusterId(),
                        handleRef.corridorId(),
                        handleRef.roomId(),
                        handleRef.index(),
                        sourceEdge(handleRef),
                        safePreview.deltaQ(),
                        safePreview.deltaR(),
                        safePreview.deltaLevel()));
        publishMutationUseCase.execute(result);
    }

    public void executeCorridorHandleMove(
            MapId mapId,
            DungeonEditorSessionValues.MoveHandlePreview preview
    ) {
        DungeonEditorSessionValues.MoveHandlePreview safePreview =
                Objects.requireNonNull(preview, "preview");
        DungeonEditorWorkspaceValues.HandleRef handleRef = safePreview.handleRef();
        ApplyDungeonEditorOperationUseCase.OperationResultData result;
        if (handleRef.kind() == DungeonEditorHandleType.CORRIDOR_ANCHOR) {
            result = handleMutationUseCase.applyCorridorAnchorMove(
                    domainMapId(mapId),
                    new ApplyDungeonEditorHandleMutationUseCase.CorridorAnchorMove(
                            handleRef.topologyRef(),
                            handleRef.corridorId(),
                            handleRef.index(),
                            safePreview.deltaQ(),
                            safePreview.deltaR(),
                            safePreview.deltaLevel()));
        } else if (handleRef.kind() == DungeonEditorHandleType.CORRIDOR_WAYPOINT) {
            result = handleMutationUseCase.applyCorridorWaypointMove(
                    domainMapId(mapId),
                    new ApplyDungeonEditorHandleMutationUseCase.CorridorWaypointMove(
                            handleRef.corridorId(),
                            handleRef.index(),
                            safePreview.deltaQ(),
                            safePreview.deltaR(),
                            safePreview.deltaLevel()));
        } else {
            return;
        }
        publishMutationUseCase.execute(result);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private static Edge sourceEdge(DungeonEditorWorkspaceValues.HandleRef handleRef) {
        if (handleRef.sourceEdge() != null) {
            return DungeonEditorWorkspaceCoreGeometry.edge(handleRef.sourceEdge());
        }
        Cell cell = DungeonEditorWorkspaceCoreGeometry.cell(handleRef.cell());
        return Direction.parse(handleRef.direction()).edgeOf(cell);
    }
}
