package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;

import java.util.List;

public record RoomExitDescriptor(
        Point2i roomCell,
        Point2i direction,
        String label,
        List<VertexEdge> edges
) {
    public RoomExitDescriptor {
        roomCell = roomCell == null ? new Point2i(0, 0) : roomCell;
        direction = direction == null ? new Point2i(0, -1) : direction;
        label = label == null || label.isBlank() ? "Ausgang" : label;
        edges = edges == null ? List.of() : List.copyOf(edges);
    }
}
