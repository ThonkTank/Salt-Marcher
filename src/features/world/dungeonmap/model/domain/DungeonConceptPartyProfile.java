package features.world.dungeonmap.model.domain;

public record DungeonConceptPartyProfile(
        Long mapId,
        int partySize
) {
    public DungeonConceptPartyProfile {
        if (mapId == null || mapId <= 0) {
            throw new IllegalArgumentException("mapId must be positive");
        }
        if (partySize <= 0) {
            throw new IllegalArgumentException("partySize must be positive");
        }
    }
}
