package features.sessionplanner.adapter.javafx;

import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import java.util.Objects;

/** Adapter-owned observation emitted after a complete synchronous workspace apply. */
public record SessionPlannerWorkspaceApplyObservation(
        SessionPlannerWorkspaceSnapshot snapshot,
        long durationNanos,
        int materializedUnitCount
) {
    public SessionPlannerWorkspaceApplyObservation {
        snapshot = Objects.requireNonNull(snapshot, "snapshot");
        durationNanos = Math.max(0L, durationNanos);
        materializedUnitCount = Math.max(0, materializedUnitCount);
    }
}
