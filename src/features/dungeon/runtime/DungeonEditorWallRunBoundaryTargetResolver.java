package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.CellTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorWallRunBoundaryTargetResolver {
    private DungeonEditorWallRunBoundaryTargetResolver() {
    }

    static @Nullable BoundaryTarget resolve(
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
