package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.GridBounds2x;
import features.world.dungeonmap.model.geometry.GridShape;

/**
 * Shared geometry-facing contract for concrete dungeon objects.
 */
public sealed interface DungeonObject permits Floor, Wall, Door {

    GridShape shape2x();

    default GridBounds2x bounds2x() {
        return shape2x().bounds();
    }
}
