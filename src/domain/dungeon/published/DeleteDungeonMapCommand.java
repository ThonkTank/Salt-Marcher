package src.domain.dungeon.published;

public record DeleteDungeonMapCommand(DungeonMapId mapId) implements DungeonMapCatalogCommand {

    public DeleteDungeonMapCommand {
        mapId = mapId == null ? new DungeonMapId(1L) : mapId;
    }

    @Override
    public int operationKey() {
        return DELETE_OPERATION;
    }

    @Override
    public String query() {
        return "";
    }

    @Override
    public long mapIdValue() {
        return mapId.value();
    }

    @Override
    public String mapName() {
        return "";
    }
}
