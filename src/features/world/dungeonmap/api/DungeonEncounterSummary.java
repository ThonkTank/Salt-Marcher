package features.world.dungeonmap.api;

public record DungeonEncounterSummary(
        long encounterId,
        String name,
        String difficulty,
        String shapeLabel,
        int slotCount
) {
    @Override
    public String toString() {
        return name != null ? name : "";
    }
}
