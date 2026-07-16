package features.party.api;

public sealed interface PartyTravelLocationSnapshot
        permits PartyDungeonTravelLocationSnapshot, PartyOverworldTravelLocationSnapshot {

    long mapId();

    default boolean isDungeon() {
        return false;
    }

    default boolean isOverworld() {
        return false;
    }

    default String dungeonLocationKindName() {
        return "TILE";
    }

    default long dungeonOwnerId() {
        return 0L;
    }

    default int dungeonTileQ() {
        return 0;
    }

    default int dungeonTileR() {
        return 0;
    }

    default int dungeonTileLevel() {
        return 0;
    }

    default String dungeonHeadingName() {
        return "SOUTH";
    }

    default long overworldTileId() {
        return 0L;
    }
}
