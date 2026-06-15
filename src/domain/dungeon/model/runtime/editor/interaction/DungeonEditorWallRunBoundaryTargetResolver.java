package src.domain.dungeon.model.runtime.editor.interaction;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.CellTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class DungeonEditorWallRunBoundaryTargetResolver {
    private DungeonEditorWallRunBoundaryTargetResolver() {
    }

    public static @Nullable BoundaryTarget resolve(
            PointerState input,
            DungeonEditorSessionValues.@Nullable Selection currentSelection
    ) {
        var handle = input.hitTarget().handleRef();
        if (!handle.clusterWallRun()
                || currentSelection == null
                || !currentSelection.clusterSelection()
                || currentSelection.clusterId() != handle.clusterId()) {
            return null;
        }
        Edge edge = handle.sourceEdge() == null
                ? fallbackEdge(handle)
                : new Edge(
                        workspaceCell(handle.sourceEdge().from()),
                        workspaceCell(handle.sourceEdge().to()));
        return boundaryTarget(handle, edge);
    }

    private static Edge fallbackEdge(DungeonEditorMainViewInteractionValues.HandleTarget handle) {
        Direction direction = Direction.valueOf(handle.direction());
        return direction.edgeOf(new Cell(
                handle.anchor().q(),
                handle.anchor().r(),
                handle.anchor().level()));
    }

    private static Cell workspaceCell(DungeonEditorWorkspaceValues.Cell cell) {
        return cell == null ? new Cell(0, 0, 0) : new Cell(cell.q(), cell.r(), cell.level());
    }

    private static BoundaryTarget boundaryTarget(
            DungeonEditorMainViewInteractionValues.HandleTarget handle,
            Edge edge
    ) {
        return new BoundaryTarget(
                true,
                DungeonEditorMainViewInteractionValues.WALL_KIND,
                "",
                handle.ownerId(),
                handle.clusterId(),
                handle.topologyRefKind(),
                handle.topologyRefId(),
                new CellTarget(edge.from().q(), edge.from().r(), edge.from().level()),
                new CellTarget(edge.to().q(), edge.to().r(), edge.to().level()));
    }
}
