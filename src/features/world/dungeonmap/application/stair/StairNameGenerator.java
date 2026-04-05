package features.world.dungeonmap.application.stair;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

public final class StairNameGenerator {

    private StairNameGenerator() {
    }

    public static String nextName(DungeonLayout layout) {
        DungeonLayout resolvedLayout = Objects.requireNonNull(layout, "layout");
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
