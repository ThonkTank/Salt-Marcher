package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;

import java.util.List;

public record RoomExitDescriptor(
        int number,
        Point2i roomCell,
        Point2i outsideCell,
        Point2i direction,
        String label,
        VertexEdge anchorEdge,
        List<VertexEdge> edges
) {
    public RoomExitDescriptor {
        number = number <= 0 ? 1 : number;
        roomCell = roomCell == null ? new Point2i(0, 0) : roomCell;
        outsideCell = outsideCell == null ? roomCell.add(direction == null ? new Point2i(0, -1) : direction) : outsideCell;
        direction = direction == null ? new Point2i(0, -1) : direction;
        label = label == null || label.isBlank() ? "Tuer " + number : label;
        anchorEdge = anchorEdge == null ? VertexEdge.betweenCellAndStep(roomCell, direction) : anchorEdge;
        edges = edges == null ? List.of() : List.copyOf(edges);
    }
}
