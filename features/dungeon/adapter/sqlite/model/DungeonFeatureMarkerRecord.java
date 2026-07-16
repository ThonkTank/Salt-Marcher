package features.dungeon.adapter.sqlite.model;

/**
 * Source-local feature marker row.
 */
public record DungeonFeatureMarkerRecord(
        long markerId,
        long mapId,
        String markerKind,
        int cellX,
        int cellY,
        int levelZ,
        String label,
        String description
) {

    public DungeonFeatureMarkerRecord {
        markerKind = markerKind == null ? "" : markerKind.trim();
        label = label == null ? "" : label.trim();
        description = description == null ? "" : description.trim();
    }
}
