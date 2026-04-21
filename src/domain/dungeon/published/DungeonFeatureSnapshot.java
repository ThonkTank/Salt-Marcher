package src.domain.dungeon.published;

import java.util.List;

public record DungeonFeatureSnapshot(
        DungeonFeatureKind kind,
        long id,
        String label,
        List<DungeonCellRef> cells,
        String description,
        String destinationLabel
) {

    public DungeonFeatureSnapshot {
        kind = defaultKind(kind);
        id = positiveId(id);
        label = displayLabel(label, kind);
        cells = immutableCells(cells);
        description = cleanText(description);
        destinationLabel = cleanText(destinationLabel);
    }

    private static DungeonFeatureKind defaultKind(DungeonFeatureKind kind) {
        return kind == null ? DungeonFeatureKind.STAIR : kind;
    }

    private static long positiveId(long id) {
        return Math.max(1L, id);
    }

    private static String displayLabel(String label, DungeonFeatureKind kind) {
        return label == null || label.isBlank() ? kind.name() : label.trim();
    }

    private static List<DungeonCellRef> immutableCells(List<DungeonCellRef> cells) {
        return cells == null ? List.of() : List.copyOf(cells);
    }

    private static String cleanText(String text) {
        return text == null ? "" : text.trim();
    }
}
