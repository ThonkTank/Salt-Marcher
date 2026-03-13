package features.world.dungeonmap.service.catalog;

public record DungeonEncounterTableSummary(long tableId, String name) {
    @Override
    public String toString() {
        return name != null ? name : "";
    }
}
