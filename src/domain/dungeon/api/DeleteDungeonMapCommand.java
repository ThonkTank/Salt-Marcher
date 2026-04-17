package src.domain.dungeon.api;

/**
 * Command for deleting an authored dungeon map.
 */
public record DeleteDungeonMapCommand(
        DungeonMapId mapId
) {
}
