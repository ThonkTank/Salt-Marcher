package features.dungeon.application.editor.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.projection.DungeonBoundaryFacts;
import features.dungeon.domain.core.projection.DungeonMapFacts;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;

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
                features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind.fromExternalKind(boundary.kind()),
                boundary.id(),
                boundary.label(),
                workspaceEdge(boundary.edge()),
                boundary.topologyRef());
    }

    private static features.dungeon.domain.core.geometry.Edge workspaceEdge(@Nullable Edge edge) {
        return edge == null
                ? new features.dungeon.domain.core.geometry.Edge(cell(null), cell(null))
                : new features.dungeon.domain.core.geometry.Edge(cell(edge.from()), cell(edge.to()));
    }

    private static features.dungeon.domain.core.geometry.Cell cell(@Nullable Cell cell) {
        return cell == null
                ? features.dungeon.domain.core.geometry.Cell.empty()
                : new features.dungeon.domain.core.geometry.Cell(cell.q(), cell.r(), cell.level());
    }
}
