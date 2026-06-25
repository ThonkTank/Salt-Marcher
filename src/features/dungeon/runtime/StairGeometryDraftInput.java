package src.features.dungeon.runtime;

public record StairGeometryDraftInput(
        long stairId,
        String shapeName,
        String directionName,
        String dimension1,
        String dimension2
) {
    public StairGeometryDraftInput {
        stairId = Math.max(0L, stairId);
        shapeName = safeText(shapeName);
        directionName = safeText(directionName);
        dimension1 = safeText(dimension1);
        dimension2 = safeText(dimension2);
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
