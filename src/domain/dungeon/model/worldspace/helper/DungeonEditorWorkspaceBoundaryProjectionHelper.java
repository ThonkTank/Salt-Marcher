package src.domain.dungeon.model.worldspace.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.DungeonBoundaryFacts;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonEdge;
import src.domain.dungeon.model.worldspace.DungeonMapFacts;
import src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceBoundaryProjectionHelper {
    public List<DungeonEditorWorkspaceValues.Boundary> project(DungeonMapFacts safeFacts) {
        List<DungeonEditorWorkspaceValues.Boundary> boundaries = new ArrayList<>();
        for (DungeonBoundaryFacts boundary : safeFacts.boundaries()) {
            boundaries.add(boundary(boundary));
        }
        return List.copyOf(boundaries);
    }

    private static DungeonEditorWorkspaceValues.Boundary boundary(DungeonBoundaryFacts boundary) {
        return new DungeonEditorWorkspaceValues.Boundary(
                DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(boundary.kind()),
                boundary.id(),
                boundary.label(),
                workspaceEdge(boundary.edge()),
                boundary.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Edge workspaceEdge(@Nullable DungeonEdge edge) {
        return edge == null
                ? new DungeonEditorWorkspaceValues.Edge(cell(null), cell(null))
                : new DungeonEditorWorkspaceValues.Edge(cell(edge.from()), cell(edge.to()));
    }

    private static DungeonEditorWorkspaceValues.Cell cell(@Nullable DungeonCell cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }
}
