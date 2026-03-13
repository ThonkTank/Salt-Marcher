package features.world.dungeonmap.model.domain;

public record DungeonAreaEncounterTableLink(
        Long tableId,
        int weight,
        int sortOrder
) {
    public DungeonAreaEncounterTableLink {
        if (weight < 1) {
            weight = 1;
        }
    }
}
