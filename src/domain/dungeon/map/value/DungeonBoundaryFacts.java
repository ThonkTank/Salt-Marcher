package src.domain.dungeon.map.value;

public record DungeonBoundaryFacts(
        String kind,
        long id,
        String label,
        DungeonEdge edge
) {

    public DungeonBoundaryFacts {
        kind = kind == null || kind.isBlank() ? "boundary" : kind;
        label = label == null || label.isBlank() ? "Boundary" : label;
    }
}
