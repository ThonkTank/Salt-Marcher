package features.sessionplanner.adapter.sqlite.model;

public record SessionTreasureItemRecord(
        long treasureId,
        long lineId,
        String role,
        String itemId,
        String text,
        long quantity,
        long unitCp,
        long actualCp,
        String totalCapacity,
        String allowedContainers,
        String magicRarity,
        boolean cursed,
        int sortOrder
) {
}
