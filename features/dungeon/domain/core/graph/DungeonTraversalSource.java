package features.dungeon.domain.core.graph;

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
        if (safeKind == DungeonTraversalSourceKind.STAIR) {
            return "Treppe " + id;
        }
        if (safeKind == DungeonTraversalSourceKind.CORRIDOR) {
            return "Gang " + id;
        }
        return "Tür " + id;
    }
}
