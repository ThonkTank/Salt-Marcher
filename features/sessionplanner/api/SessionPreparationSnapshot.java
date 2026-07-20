package features.sessionplanner.api;

import java.util.Objects;

public record SessionPreparationSnapshot(
        SessionPreparationStatus status,
        String message,
        long sessionId,
        long attemptId,
        boolean cancelEnabled
) {

    public SessionPreparationSnapshot {
        status = Objects.requireNonNull(status, "status");
        message = Objects.requireNonNullElse(message, "").trim();
        sessionId = Math.max(0L, sessionId);
        attemptId = Math.max(0L, attemptId);
        cancelEnabled = cancelEnabled && switch (status) {
            case GENERATING, RESOLVING_ENCOUNTERS, SAVING -> true;
            default -> false;
        };
    }

    public static SessionPreparationSnapshot idle() {
        return new SessionPreparationSnapshot(
                SessionPreparationStatus.IDLE, "", 0L, 0L, false);
    }
}
