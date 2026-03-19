package features.world.dungeonmap.model.geometry;

import java.util.List;

public record VertexPath(List<Point2i> vertices) {

    public static final Point2i LOOP_SEPARATOR = new Point2i(Integer.MIN_VALUE, Integer.MIN_VALUE);

    public VertexPath {
        vertices = vertices == null ? List.of() : List.copyOf(vertices);
    }
}
