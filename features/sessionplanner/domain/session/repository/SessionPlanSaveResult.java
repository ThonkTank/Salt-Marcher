package features.sessionplanner.domain.session.repository;

import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRevision;
import java.util.Objects;
import java.util.Optional;

public record SessionPlanSaveResult(
        Status status,
        SessionRevision expectedRevision,
        Optional<SessionRevision> currentRevision,
        Optional<SessionPlan> committedSession
) {

    public SessionPlanSaveResult {
        status = Objects.requireNonNull(status, "status");
        expectedRevision = Objects.requireNonNull(expectedRevision, "expectedRevision");
        currentRevision = Objects.requireNonNull(currentRevision, "currentRevision");
        committedSession = Objects.requireNonNull(committedSession, "committedSession");
        if ((status == Status.SUCCESS) != committedSession.isPresent()) {
            throw new IllegalArgumentException("only a successful save exposes a committed session");
        }
    }

    public enum Status {
        SUCCESS,
        STALE,
        NOT_FOUND,
        ALREADY_EXISTS
    }
}
