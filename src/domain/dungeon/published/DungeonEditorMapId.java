package src.domain.dungeon.published;

public record DungeonEditorMapId(
        long value
) {

    public DungeonEditorMapId {
        value = Math.max(1L, value);
    }
}
