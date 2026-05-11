package src.domain.dungeon.model.map.model;

public final class DungeonTravelExternalTargetFacts {

    private static final String OVERWORLD_TILE_KIND = "OVERWORLD_TILE";

    private final String kind;
    private final long mapId;
    private final long tileId;

    private DungeonTravelExternalTargetFacts(
            String kind,
            long mapId,
            long tileId
    ) {
        this.kind = kind == null || kind.isBlank() ? OVERWORLD_TILE_KIND : kind.trim();
        this.mapId = Math.max(0L, mapId);
        this.tileId = Math.max(0L, tileId);
    }

    public static DungeonTravelExternalTargetFacts overworldTile(long mapId, long tileId) {
        return new DungeonTravelExternalTargetFacts(OVERWORLD_TILE_KIND, mapId, tileId);
    }

    public boolean isOverworldTile() {
        return OVERWORLD_TILE_KIND.equals(kind);
    }

    public long mapId() {
        return mapId;
    }

    public long tileId() {
        return tileId;
    }
}
