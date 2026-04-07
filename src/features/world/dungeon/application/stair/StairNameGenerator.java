package features.world.dungeon.application.stair;

import features.world.dungeon.dungoenmap.model.DungeonMap;
import features.world.dungeon.model.structures.stair.DungeonStair;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

public final class StairNameGenerator {

    private StairNameGenerator() {
    }

    public static String nextName(DungeonMap layout) {
        DungeonMap resolvedLayout = Objects.requireNonNull(layout, "layout");
        Set<String> used = new LinkedHashSet<>();
        for (DungeonStair stair : resolvedLayout.stairs()) {
            if (stair != null && stair.name() != null && !stair.name().isBlank()) {
                used.add(stair.name());
            }
        }
        int next = 1;
        while (used.contains("Treppe " + next)) {
            next++;
        }
        return "Treppe " + next;
    }
}
