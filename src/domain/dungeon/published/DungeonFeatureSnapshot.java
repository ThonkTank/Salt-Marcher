package src.domain.dungeon.published;

import java.util.List;

public record DungeonFeatureSnapshot(
        DungeonFeatureKind kind,
        long id,
        String label,
        List<DungeonCellRef> cells,
        String description,
        String destinationLabel,
        DungeonTopologyElementRef topologyRef
) {

    public DungeonFeatureSnapshot(
            DungeonFeatureKind kind,
            long id,
            String label,
            List<DungeonCellRef> cells,
            String description,
            String destinationLabel
    ) {
        this(kind, id, label, cells, description, destinationLabel, defaultTopologyRef(kind, id));
    }

    public DungeonFeatureSnapshot {
        kind = defaultKind(kind);
        id = positiveId(id);
        label = displayLabel(label, kind);
        cells = immutableCells(cells);
        description = cleanText(description);
        destinationLabel = cleanText(destinationLabel);
        topologyRef = topologyRef == null
                ? new DungeonTopologyElementRef(featureTopologyKind(kind), id)
                : topologyRef;
    }

    @Override
    public List<DungeonCellRef> cells() {
        return immutableCells(cells);
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

    private static DungeonTopologyElementKind featureTopologyKind(DungeonFeatureKind kind) {
        return kind == DungeonFeatureKind.TRANSITION
                ? DungeonTopologyElementKind.TRANSITION
                : defaultNonTransitionTopologyKind(kind);
    }

    private static DungeonTopologyElementKind defaultNonTransitionTopologyKind(DungeonFeatureKind kind) {
        if (kind == DungeonFeatureKind.STAIR) {
            return DungeonTopologyElementKind.STAIR;
        }
        return isMarker(kind) ? DungeonTopologyElementKind.FEATURE_MARKER : DungeonTopologyElementKind.EMPTY;
    }

    private static boolean isMarker(DungeonFeatureKind kind) {
        return kind == DungeonFeatureKind.OBJECT || kind == DungeonFeatureKind.ENCOUNTER || kind == DungeonFeatureKind.POI;
    }

    private static DungeonTopologyElementRef defaultTopologyRef(DungeonFeatureKind kind, long id) {
        DungeonFeatureKind safeKind = defaultKind(kind);
        return new DungeonTopologyElementRef(featureTopologyKind(safeKind), positiveId(id));
    }
}
