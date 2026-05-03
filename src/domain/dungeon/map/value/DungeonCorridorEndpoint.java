package src.domain.dungeon.map.value;

public sealed interface DungeonCorridorEndpoint permits
        DungeonCorridorDoorEndpoint,
        DungeonCorridorAnchorEndpoint {

    DungeonCell corridorCell();

    int level();
}
