package features.sessionplanner.adapter.sqlite.model;

public record SessionTreasurePackingRecord(
        long treasureId,
        long lineId,
        String containerType,
        int containerCount,
        String containerId,
        boolean valid,
        int sortOrder
) {
}
