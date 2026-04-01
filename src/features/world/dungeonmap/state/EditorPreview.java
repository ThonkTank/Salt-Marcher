package features.world.dungeonmap.state;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.LinkedHashSet;
import java.util.Set;

public sealed interface EditorPreview permits EditorPreview.LayoutPreview, EditorPreview.PaintPreview, EditorPreview.BoundaryPreview {

    record LayoutPreview(DungeonLayout layout) implements EditorPreview {
    }

    record PaintPreview(TileShape shape, boolean deleteMode) implements EditorPreview {
        public PaintPreview {
            shape = shape == null ? TileShape.empty() : shape;
        }
    }

    record BoundaryPreview(
            Set<GridSegment2x> edges,
            Set<GridSegment2x> skippedConnectionEdges,
            GridPoint2x startVertex2x,
            GridPoint2x currentVertex2x,
            boolean deleteMode
    ) implements EditorPreview {
        public BoundaryPreview {
            edges = edges == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(edges));
            skippedConnectionEdges = skippedConnectionEdges == null
                    ? Set.of()
                    : Set.copyOf(new LinkedHashSet<>(skippedConnectionEdges));
        }
    }
}
