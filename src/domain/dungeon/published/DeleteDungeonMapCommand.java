package src.domain.dungeon.published;

public record DeleteDungeonMapCommand(DungeonMapId mapId) implements DungeonMapCatalogCommand {

    public DeleteDungeonMapCommand {
        mapId = mapId == null ? new DungeonMapId(1L) : mapId;
    }
}
