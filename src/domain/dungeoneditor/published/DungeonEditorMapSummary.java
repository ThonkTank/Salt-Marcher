package src.domain.dungeoneditor.published;

public record DungeonEditorMapSummary(
        DungeonEditorMapId mapId,
        String mapName,
        long revision
) {

    public DungeonEditorMapSummary {
        mapId = mapId == null ? new DungeonEditorMapId(1L) : mapId;
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
        revision = Math.max(0L, revision);
    }
}
