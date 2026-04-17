package src.domain.dungeon.api;

/**
 * Command for creating an empty dungeon map aggregate.
 */
public record CreateDungeonMapCommand(
        String mapName
) {

    public CreateDungeonMapCommand {
        mapName = mapName == null ? "" : mapName.trim();
    }
}
