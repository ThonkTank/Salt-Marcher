package features.world.dungeonmap.model.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public record DungeonArea(
        Long areaId,
        Long mapId,
        String name,
        int encounterEveryHours,
        List<DungeonAreaEncounterTableLink> encounterTableLinks
) {
    public static final int DEFAULT_ENCOUNTER_EVERY_HOURS = 6;

    public DungeonArea {
        if (encounterEveryHours < 1) {
            encounterEveryHours = DEFAULT_ENCOUNTER_EVERY_HOURS;
        }
        List<DungeonAreaEncounterTableLink> safeLinks = encounterTableLinks == null ? List.of() : encounterTableLinks;
        ArrayList<DungeonAreaEncounterTableLink> sortedLinks = new ArrayList<>(safeLinks);
        sortedLinks.sort(Comparator
                .comparingInt(DungeonAreaEncounterTableLink::sortOrder)
                .thenComparing(link -> link.tableId() == null ? Long.MAX_VALUE : link.tableId()));
        encounterTableLinks = List.copyOf(sortedLinks);
    }

    @Override
    public String toString() {
        return name;
    }
}
