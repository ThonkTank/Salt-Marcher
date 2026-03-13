package features.world.dungeonmap.service.runtime;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonAreaEncounterTableLink;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

final class DungeonRuntimeEncounterRollService {

    List<Long> rollEncounterTables(DungeonArea area) {
        if (area == null || area.encounterTableLinks().isEmpty()) {
            return List.of();
        }
        int effectiveHours = Math.max(1, area.encounterEveryHours());
        double baseChance = 1.0d / (effectiveHours * 6.0d);
        int totalWeight = area.encounterTableLinks().stream().mapToInt(DungeonAreaEncounterTableLink::weight).sum();
        if (totalWeight < 1) {
            return List.of();
        }

        ArrayList<Long> triggeredTableIds = new ArrayList<>();
        ThreadLocalRandom random = ThreadLocalRandom.current();
        // Area weights split the total encounter chance into independent per-table rolls.
        for (DungeonAreaEncounterTableLink link : area.encounterTableLinks()) {
            if (link == null || link.tableId() == null) {
                continue;
            }
            double tableChance = baseChance * link.weight() / totalWeight;
            if (random.nextDouble() < tableChance) {
                triggeredTableIds.add(link.tableId());
            }
        }
        return List.copyOf(triggeredTableIds);
    }
}
