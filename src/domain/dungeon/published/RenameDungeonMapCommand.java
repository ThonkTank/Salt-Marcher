package src.domain.dungeon.published;

/**
 * Command for renaming an authored dungeon map.
 */
public record RenameDungeonMapCommand(
        DungeonMapId mapId,
        String mapName
) {

    public RenameDungeonMapCommand {
        mapName = mapName == null ? "" : mapName.trim();
    }
}
