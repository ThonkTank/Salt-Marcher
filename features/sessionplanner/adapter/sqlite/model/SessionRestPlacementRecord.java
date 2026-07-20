package features.sessionplanner.adapter.sqlite.model;

public record SessionRestPlacementRecord(
        long leftEncounterId,
        long rightEncounterId,
        String restKind,
        int sortOrder
) {

    public SessionRestPlacementRecord {
        leftEncounterId = Math.max(0L, leftEncounterId);
        rightEncounterId = Math.max(0L, rightEncounterId);
        restKind = restKind == null ? "NONE" : restKind.trim();
        sortOrder = Math.max(0, sortOrder);
    }
}
