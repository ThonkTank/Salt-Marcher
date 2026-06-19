package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.HandleInput;
import src.domain.dungeon.model.runtime.usecase.MoveDungeonEditorHandleUseCase.HandleMoveInput;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.HandleTarget;

final class DungeonEditorHandleInputTranslator {

    private DungeonEditorHandleInputTranslator() {
    }

    static HandleMoveInput handleMoveInput(HandleTarget handle, int q, int r) {
        HandleTarget safeHandle = handle == null ? HandleTarget.empty() : handle;
        return new HandleMoveInput(
                DungeonEditorRuntimeEnumTranslator.normalizedEnumName(safeHandle.kind()),
                DungeonEditorRuntimeEnumTranslator.normalizedEnumName(safeHandle.topologyKind()),
                safeHandle.topologyId(),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.orderIndex(),
                safeHandle.q(),
                safeHandle.r(),
                safeHandle.level(),
                safeHandle.direction(),
                safeHandle.sourceStartQ(),
                safeHandle.sourceStartR(),
                safeHandle.sourceStartLevel(),
                safeHandle.sourceEndQ(),
                safeHandle.sourceEndR(),
                safeHandle.sourceEndLevel(),
                q,
                r);
    }

    static HandleInput handleInput(HandleTarget handle) {
        HandleTarget safeHandle = handle == null ? HandleTarget.empty() : handle;
        return new HandleInput(
                DungeonEditorRuntimeEnumTranslator.handleKind(safeHandle.kind()),
                DungeonEditorRuntimeInputValues.topologyRef(safeHandle.topologyKind(), safeHandle.topologyId()),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.orderIndex(),
                DungeonEditorRuntimeInputValues.cellInput(safeHandle.q(), safeHandle.r(), safeHandle.level()),
                safeHandle.direction(),
                sourceEdgeInput(safeHandle));
    }

    private static BoundaryInput sourceEdgeInput(HandleTarget handle) {
        return handle.sourceEdgePresent()
                ? new BoundaryInput(
                        BoundaryKindInput.WALL,
                        "",
                        handle.ownerId(),
                        DungeonEditorRuntimeInputValues.topologyRef(handle.topologyKind(), handle.topologyId()),
                        DungeonEditorRuntimeInputValues.cellInput(
                                handle.sourceStartQ(),
                                handle.sourceStartR(),
                                handle.sourceStartLevel()),
                        DungeonEditorRuntimeInputValues.cellInput(
                                handle.sourceEndQ(),
                                handle.sourceEndR(),
                                handle.sourceEndLevel()))
                : BoundaryInput.empty();
    }
}
