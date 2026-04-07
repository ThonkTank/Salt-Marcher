package features.world.dungeonmap.geometry;

import java.util.Set;

public abstract class GridObject {

    public abstract GridObject translatedByCells(int dx, int dy, int dz);

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
