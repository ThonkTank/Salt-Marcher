package src.domain.dungeon.published;

public record DeleteDungeonMapCommand(DungeonMapId mapId) implements DungeonMapCatalogCommand {

    public DeleteDungeonMapCommand {
        mapId = mapId == null ? new DungeonMapId(1L) : mapId;
    }

    @Override
    public String actionKey() {
        return DELETE;
    }

    @Override
    public long mapIdValue() {
        return mapId.value();
    }
}
