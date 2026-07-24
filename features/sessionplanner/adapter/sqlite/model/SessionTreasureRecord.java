package features.sessionplanner.adapter.sqlite.model;

public record SessionTreasureRecord(
        long treasureId,
        long sceneId,
        String title,
        String note,
        String stockClass,
        String channel,
        String theme,
        String magicType,
        long targetCp,
        int nonMagicSlots,
        int magicSlots,
        int sortOrder
) {
}
