package src.domain.dungeon.published;

public record SelectDungeonEditorMapCommand(DungeonMapId mapId) {
    public SelectDungeonEditorMapCommand {
        mapId = mapId == null ? new DungeonMapId(1L) : mapId;
    }
}
