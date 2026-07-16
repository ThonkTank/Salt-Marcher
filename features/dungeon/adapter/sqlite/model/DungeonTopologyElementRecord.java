package features.dungeon.adapter.sqlite.model;

import org.jspecify.annotations.Nullable;

import java.util.Locale;

public record DungeonTopologyElementRecord(
        long mapId,
        String elementKind,
        long elementId,
        @Nullable Long clusterId,
        @Nullable Long corridorId,
        String label,
        int sortOrder
) {

    public DungeonTopologyElementRecord {
        elementKind = elementKind == null || elementKind.isBlank()
                ? "EMPTY"
                : elementKind.trim().toUpperCase(Locale.ROOT);
        elementId = Math.max(0L, elementId);
        clusterId = DungeonRecordIdNormalizer.positiveLongOrNull(clusterId);
        corridorId = DungeonRecordIdNormalizer.positiveLongOrNull(corridorId);
        label = label == null ? "" : label.trim();
        sortOrder = Math.max(0, sortOrder);
    }
}
