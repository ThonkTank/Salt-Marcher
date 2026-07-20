package features.sessionplanner.domain.session.repository;

import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRevision;
import java.util.Objects;
import java.util.Optional;

/** Guarded, atomic catalog-delete outcome including the authoritative current root. */
public record SessionPlanDeleteResult(
        Status status,
        long targetSessionId,
        SessionRevision expectedRevision,
        Optional<SessionRevision> currentTargetRevision,
        Optional<SessionPlan> authoritativeCurrent
) {

    public SessionPlanDeleteResult {
        status = Objects.requireNonNull(status, "status");
        if (targetSessionId <= 0L) {
            throw new IllegalArgumentException("target session id must be positive");
        }
        expectedRevision = Objects.requireNonNull(expectedRevision, "expectedRevision");
        currentTargetRevision = currentTargetRevision == null ? Optional.empty() : currentTargetRevision;
        authoritativeCurrent = authoritativeCurrent == null ? Optional.empty() : authoritativeCurrent;
        if (status == Status.SUCCESS && authoritativeCurrent.isEmpty()) {
            throw new IllegalArgumentException("successful delete requires authoritative current session");
        }
    }

    public enum Status {
        SUCCESS,
        STALE,
        NOT_FOUND,
        STORAGE_FAILURE
    }
}
