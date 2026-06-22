package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.HandleTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.SourceEdgeTarget;

final class DungeonEditorHandleInputTranslator {

    private DungeonEditorHandleInputTranslator() {
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
                sourceEdge(safeHandle),
                sourceEdges(safeHandle));
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

    private static List<DungeonEditorWorkspaceValues.Edge> sourceEdges(HandleTarget handle) {
        List<DungeonEditorWorkspaceValues.Edge> result = new ArrayList<>();
        for (SourceEdgeTarget edge : handle.sourceEdges()) {
            if (edge != null && edge.present()) {
                result.add(new DungeonEditorWorkspaceValues.Edge(
                        DungeonEditorRuntimeInputValues.cell(edge.startQ(), edge.startR(), edge.startLevel()),
                        DungeonEditorRuntimeInputValues.cell(edge.endQ(), edge.endR(), edge.endLevel())));
            }
        }
        return List.copyOf(result);
    }
}
