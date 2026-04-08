package features.world.dungeon.geometry;

import java.util.Set;

/**
 * Public root owner object for dungeon geometry.
 *
 * <p>Cross-owner callers may depend on this root seam without reaching into geometry-internal inheritance details.
 */
public abstract class GeometryObject<T extends GeometryObject<T>> implements GridTranslatable<T>, GridOccupant {

    public abstract T translated(GridTranslation translation);

    public abstract Set<Integer> levels();

    public abstract GridArea cellFootprint();

    public int primaryLevel() {
        return levels().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public boolean occupiesLevel(int levelZ) {
        return levels().contains(levelZ);
    }
}
