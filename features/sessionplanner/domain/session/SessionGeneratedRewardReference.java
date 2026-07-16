package features.sessionplanner.domain.session;

public record SessionGeneratedRewardReference(
        long sceneId,
        String generationId,
        long treasureId,
        String lastKnownLabel
) {

    public SessionGeneratedRewardReference {
        if (sceneId <= 0L) {
            throw new IllegalArgumentException("Scene id must be positive");
        }
        generationId = generationId == null ? "" : generationId.trim();
        if (generationId.isEmpty()) {
            throw new IllegalArgumentException("Generation id must not be empty");
        }
        if (treasureId <= 0L) {
            throw new IllegalArgumentException("Treasure id must be positive");
        }
        lastKnownLabel = lastKnownLabel == null ? "" : lastKnownLabel.trim();
    }
}
