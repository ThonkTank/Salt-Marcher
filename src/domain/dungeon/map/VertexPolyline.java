package src.domain.dungeon.map;

import java.util.List;

public record VertexPolyline(
        int floor,
        List<DungeonCell> vertices
) {

    private static final int MINIMUM_VERTEX_COUNT = 2;

    public VertexPolyline {
        vertices = vertices == null ? List.of() : List.copyOf(vertices);
        if (vertices.size() < MINIMUM_VERTEX_COUNT) {
            throw new IllegalArgumentException("VertexPolyline requires at least two vertices.");
        }
    }
}
