package features.dungeon.api;

public record DungeonEditorMapHitRef(String value) {
    public DungeonEditorMapHitRef {
        value = value == null ? "" : value;
    }
}
