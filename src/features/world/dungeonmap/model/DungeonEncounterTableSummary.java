package features.world.dungeonmap.model;

public record DungeonEncounterTableSummary(long tableId, String name) {
    @Override
    public String toString() {
        return name != null ? name : "";
    }
}
