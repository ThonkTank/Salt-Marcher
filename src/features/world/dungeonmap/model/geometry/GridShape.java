package features.world.dungeonmap.model.geometry;

public sealed interface GridShape permits TileFaceShape, EdgePathShape, VertexShape, CompositeShape {

    GridBounds2x bounds();

    GridShape translatedByCells(Point2i delta);

    default boolean isEmpty() {
        return bounds().isEmpty();
    }
}
