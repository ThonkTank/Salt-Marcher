package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
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

    static DungeonEditorWorkspaceValues.HandleRef handleRef(HandleTarget handle) {
        HandleTarget safeHandle = handle == null ? HandleTarget.empty() : handle;
        return new DungeonEditorWorkspaceValues.HandleRef(
                DungeonEditorRuntimeEnumTranslator.handleType(safeHandle.kind()),
                DungeonEditorRuntimeInputValues.topologyRef(safeHandle.topologyKind(), safeHandle.topologyId()),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.orderIndex(),
                DungeonEditorRuntimeInputValues.cell(safeHandle.q(), safeHandle.r(), safeHandle.level()),
                safeHandle.direction(),
                sourceEdge(safeHandle));
    }

    private static DungeonEditorWorkspaceValues.Edge sourceEdge(HandleTarget handle) {
        return handle.sourceEdgePresent()
                ? new DungeonEditorWorkspaceValues.Edge(
                        DungeonEditorRuntimeInputValues.cell(
                                handle.sourceStartQ(),
                                handle.sourceStartR(),
                                handle.sourceStartLevel()),
                        DungeonEditorRuntimeInputValues.cell(
                                handle.sourceEndQ(),
                                handle.sourceEndR(),
                                handle.sourceEndLevel()))
                : null;
    }
}
