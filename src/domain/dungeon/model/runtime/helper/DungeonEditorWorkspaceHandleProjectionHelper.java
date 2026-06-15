package src.domain.dungeon.model.runtime.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjection;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceHandleProjectionHelper {
    public List<DungeonEditorWorkspaceValues.Handle> project(List<DungeonEditorHandleProjection> handles) {
        List<DungeonEditorWorkspaceValues.Handle> workspaceHandles = new ArrayList<>();
        List<DungeonEditorHandleProjection> safeHandles = handles == null ? List.of() : List.copyOf(handles);
        for (DungeonEditorHandleProjection handle : safeHandles) {
            workspaceHandles.add(handle(handle));
        }
        return List.copyOf(workspaceHandles);
    }

    private static DungeonEditorWorkspaceValues.Handle handle(DungeonEditorHandleProjection handle) {
        DungeonEditorWorkspaceValues.Cell workspaceCell = cell(handle.cell());
        DungeonEditorWorkspaceValues.HandleRef ref = new DungeonEditorWorkspaceValues.HandleRef(
                DungeonEditorHandleType.valueOf(handle.kind().name()),
                handle.topologyRef(),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                workspaceCell,
                handle.direction().name(),
                edge(handle.sourceEdge()));
        return new DungeonEditorWorkspaceValues.Handle(ref, handle.label(), workspaceCell);
    }

    private static DungeonEditorWorkspaceValues.Cell cell(@Nullable Cell cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }

    private static DungeonEditorWorkspaceValues.Edge edge(@Nullable Edge edge) {
        return edge == null
                ? null
                : new DungeonEditorWorkspaceValues.Edge(cell(edge.from()), cell(edge.to()));
    }
}
