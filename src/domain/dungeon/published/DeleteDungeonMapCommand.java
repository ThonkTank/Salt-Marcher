package src.domain.dungeon.published;

/**
 * Command for deleting an authored dungeon map.
 */
public record DeleteDungeonMapCommand(
        DungeonMapId mapId
) {
}
