package features.world.dungeonmap.api.catalog;

public record DungeonEncounterTableSummary(long tableId, String name) {
    @Override
    public String toString() {
        return name != null ? name : "";
    }
}
