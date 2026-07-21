package features.dungeon.application.editor.helper;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.domain.core.structure.door.DoorBoundaryPreviewRelocation.DoorBoundaryPreviewPlan;
import features.dungeon.domain.core.structure.door.DoorBoundaryPreviewRelocation.PreviewBoundary;
import features.dungeon.domain.core.structure.door.DoorBoundaryPreviewRelocation.PreviewBoundaryKind;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Boundary;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;

public final class PreviewDungeonEditorDoorBoundaryProjectionHelper {

    public List<PreviewBoundary> previewBoundaries(List<Boundary> boundaries) {
        List<PreviewBoundary> result = new ArrayList<>();
        for (Boundary boundary : boundaries) {
            if (boundary != null) {
                result.add(previewBoundary(boundary));
            }
        }
        return List.copyOf(result);
    }

    public List<Boundary> movedBoundaries(List<Boundary> source, DoorBoundaryPreviewPlan plan) {
        List<Boundary> result = new ArrayList<>();
        for (Boundary boundary : source) {
            PreviewBoundary replacement = plan.replacementFor(previewBoundary(boundary));
            result.add(replacement == null ? boundary : boundary(replacement));
        }
        return List.copyOf(result);
    }

    public features.dungeon.domain.core.geometry.Edge coreEdge(Edge edge) {
        return new features.dungeon.domain.core.geometry.Edge(coreCell(edge.from()), coreCell(edge.to()));
    }

    private static PreviewBoundary previewBoundary(Boundary boundary) {
        return new PreviewBoundary(
                boundary.id(),
                boundary.label(),
                new features.dungeon.domain.core.geometry.Edge(
                        coreCell(boundary.edge().from()),
                        coreCell(boundary.edge().to())),
                boundary.topologyRef(),
                boundary.kind().isDoor()
                        ? PreviewBoundaryKind.DOOR
                        : PreviewBoundaryKind.WALL);
    }

    private static Boundary boundary(PreviewBoundary boundary) {
        return new Boundary(
                switch (boundary.kind()) {
                    case DOOR -> BoundaryKind.DOOR;
                    case OPEN, WALL -> BoundaryKind.WALL;
                },
                boundary.id(),
                boundary.label(),
                new Edge(workspaceCell(boundary.edge().from()), workspaceCell(boundary.edge().to())),
                boundary.topologyRef());
    }

    private static features.dungeon.domain.core.geometry.Cell coreCell(Cell cell) {
        return new features.dungeon.domain.core.geometry.Cell(cell.q(), cell.r(), cell.level());
    }

    private static Cell workspaceCell(features.dungeon.domain.core.geometry.Cell cell) {
        return new Cell(cell.q(), cell.r(), cell.level());
    }
}
