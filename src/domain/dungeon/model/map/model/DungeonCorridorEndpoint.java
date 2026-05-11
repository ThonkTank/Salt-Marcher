package src.domain.dungeon.model.map.model;

public sealed interface DungeonCorridorEndpoint permits
        DungeonCorridorDoorEndpoint,
        DungeonCorridorAnchorEndpoint {

    boolean present();

    DungeonCell corridorCell();

    int level();

    default boolean sameLevelAs(DungeonCorridorEndpoint other) {
        return other != null && level() == other.level();
    }
}
