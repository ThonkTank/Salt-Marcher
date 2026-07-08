package src.domain.dungeon.published;

public record DungeonEditorMapHitRef(String value) {
    public DungeonEditorMapHitRef {
        value = value == null ? "" : value;
    }
}
