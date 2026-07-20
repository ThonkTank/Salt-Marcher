package features.dungeon.application.editor.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.application.editor.interaction.DungeonEditorHandleProjection;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;

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
        features.dungeon.domain.core.geometry.Cell workspaceCell = cell(handle.cell());
        DungeonEditorWorkspaceValues.HandleRef ref = new DungeonEditorWorkspaceValues.HandleRef(
                handle.kind(),
                handle.topologyRef(),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                workspaceCell,
                handle.direction(),
                edge(handle.sourceEdge()),
                edges(handle.sourceEdges()));
        return new DungeonEditorWorkspaceValues.Handle(ref, handle.label(), workspaceCell);
    }

    private static features.dungeon.domain.core.geometry.Cell cell(@Nullable Cell cell) {
        return cell == null
                ? features.dungeon.domain.core.geometry.Cell.empty()
                : new features.dungeon.domain.core.geometry.Cell(cell.q(), cell.r(), cell.level());
    }

    private static features.dungeon.domain.core.geometry.Edge edge(@Nullable Edge edge) {
        return edge == null
                ? null
                : new features.dungeon.domain.core.geometry.Edge(cell(edge.from()), cell(edge.to()));
    }

    private static List<features.dungeon.domain.core.geometry.Edge> edges(List<Edge> edges) {
        List<features.dungeon.domain.core.geometry.Edge> result = new ArrayList<>();
        for (Edge edge : edges == null ? List.<Edge>of() : edges) {
            features.dungeon.domain.core.geometry.Edge workspaceEdge = edge(edge);
            if (workspaceEdge != null) {
                result.add(workspaceEdge);
            }
        }
        return List.copyOf(result);
    }
}
