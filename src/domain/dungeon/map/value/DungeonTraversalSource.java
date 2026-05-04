package src.domain.dungeon.map.value;

public record DungeonTraversalSource(
        DungeonTraversalSourceKind kind,
        long id,
        String label
) {

    public DungeonTraversalSource {
        kind = kind == null ? DungeonTraversalSourceKind.DOOR : kind;
        id = Math.max(0L, id);
        label = label == null || label.isBlank() ? defaultLabel(kind, id) : label.trim();
    }

    private static String defaultLabel(DungeonTraversalSourceKind kind, long id) {
        return switch (kind == null ? DungeonTraversalSourceKind.DOOR : kind) {
            case DOOR -> "Tür " + id;
            case STAIR -> "Treppe " + id;
        };
    }
}
