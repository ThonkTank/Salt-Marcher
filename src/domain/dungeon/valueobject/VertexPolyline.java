package src.domain.dungeon.valueobject;

import java.util.List;

public record VertexPolyline(
        int floor,
        List<DungeonCell> vertices
) {

    public VertexPolyline {
        vertices = vertices == null ? List.of() : List.copyOf(vertices);
        if (vertices.size() < 2) {
            throw new IllegalArgumentException("VertexPolyline requires at least two vertices.");
        }
    }
}
