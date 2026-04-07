package features.world.dungeonmap.state;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;

import java.util.LinkedHashSet;
import java.util.Set;

public sealed interface EditorPreview permits EditorPreview.LayoutPreview, EditorPreview.PaintPreview, EditorPreview.BoundaryPreview {

    record LayoutPreview(DungeonLayout layout) implements EditorPreview {
    }

    record PaintPreview(Set<GridPoint> cells, int levelZ, boolean deleteMode) implements EditorPreview {
        public PaintPreview {
            cells = cells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(cells));
        }
    }

    record BoundaryPreview(
            Set<GridSegment> edges,
            GridPoint startVertex2x,
            GridPoint currentVertex2x,
            boolean deleteMode
    ) implements EditorPreview {
        public BoundaryPreview {
            edges = edges == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(edges));
        }
    }
}
