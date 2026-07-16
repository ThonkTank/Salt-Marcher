package features.sessionplanner.api;

public record ApplyGeneratedSessionCommand(
        long attemptToken,
        long sessionId,
        String generationId
) {

    public ApplyGeneratedSessionCommand {
        attemptToken = Math.max(0L, attemptToken);
        sessionId = Math.max(0L, sessionId);
        generationId = generationId == null ? "" : generationId.trim();
    }
}
