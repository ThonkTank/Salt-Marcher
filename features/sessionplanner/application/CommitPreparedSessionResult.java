package features.sessionplanner.application;

import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRevision;
import java.util.List;
import java.util.Objects;

public sealed interface CommitPreparedSessionResult permits
        CommitPreparedSessionResult.Success,
        CommitPreparedSessionResult.Invalid,
        CommitPreparedSessionResult.Stale,
        CommitPreparedSessionResult.NotFound,
        CommitPreparedSessionResult.StorageFailure {

    record Success(
            SessionRevision previousRevision,
            SessionRevision committedRevision,
            SessionPlan committedSession
    ) implements CommitPreparedSessionResult {

        public Success {
            previousRevision = Objects.requireNonNull(previousRevision, "previousRevision");
            committedRevision = Objects.requireNonNull(committedRevision, "committedRevision");
            committedSession = Objects.requireNonNull(committedSession, "committedSession");
            if (!committedRevision.equals(previousRevision.next())
                    || !committedSession.revision().equals(committedRevision)) {
                throw new IllegalArgumentException("committed revision must advance exactly once");
            }
        }
    }

    record Invalid(List<String> errors) implements CommitPreparedSessionResult {

        public Invalid {
            errors = List.copyOf(Objects.requireNonNull(errors, "errors"));
            if (errors.isEmpty() || errors.stream().anyMatch(error -> error == null || error.isBlank())) {
                throw new IllegalArgumentException("invalid result needs display-safe validation errors");
            }
        }
    }

    record Stale(SessionRevision expected, SessionRevision current)
            implements CommitPreparedSessionResult {

        public Stale {
            expected = Objects.requireNonNull(expected, "expected");
            current = Objects.requireNonNull(current, "current");
        }
    }

    record NotFound(long sessionId) implements CommitPreparedSessionResult {

        public NotFound {
            if (sessionId <= 0L) {
                throw new IllegalArgumentException("missing session id must be positive");
            }
        }
    }

    record StorageFailure(String displaySafeMessage) implements CommitPreparedSessionResult {

        public StorageFailure {
            displaySafeMessage = Objects.requireNonNullElse(displaySafeMessage, "").trim();
            if (displaySafeMessage.isEmpty()) {
                throw new IllegalArgumentException("storage failure message must not be blank");
            }
        }
    }
}
