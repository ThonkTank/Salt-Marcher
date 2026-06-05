package src.domain.dungeon.model.core.graph;

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
        DungeonTraversalSourceKind safeKind = kind == null ? DungeonTraversalSourceKind.DOOR : kind;
        return safeKind == DungeonTraversalSourceKind.STAIR ? "Treppe " + id : "Tür " + id;
    }
}
