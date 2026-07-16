package features.sessionplanner.adapter.sqlite.model;

public record SessionGeneratedRewardRecord(
        long sceneId,
        String generationId,
        long treasureId,
        String lastKnownLabel,
        int sortOrder
) {
}
