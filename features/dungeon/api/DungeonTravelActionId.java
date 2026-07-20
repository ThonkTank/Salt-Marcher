package features.dungeon.api;

/** Stable identity of one directed action on a committed Dungeon travel surface. */
public record DungeonTravelActionId(String value) {

    public DungeonTravelActionId {
        value = value == null ? "" : value.trim();
        if (value.isBlank()) {
            throw new IllegalArgumentException("Dungeon travel action id must not be blank.");
        }
    }

    public static DungeonTravelActionId fromStableFacts(long mapId, String stableActionFact) {
        String fact = stableActionFact == null ? "" : stableActionFact.trim();
        if (mapId <= 0L || fact.isBlank()) {
            throw new IllegalArgumentException("Dungeon travel action identity requires stable map and action facts.");
        }
        return new DungeonTravelActionId("map:" + mapId + ":" + fact);
    }
}
