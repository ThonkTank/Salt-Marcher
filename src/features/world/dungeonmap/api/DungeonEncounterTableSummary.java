package features.world.dungeonmap.api;

public record DungeonEncounterTableSummary(long tableId, String name) {
    @Override
    public String toString() {
        return name != null ? name : "";
    }
}
