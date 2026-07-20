package features.sessionplanner.api;

import java.util.List;

public record SessionEncounterPlanSearchSnapshot(
        long requestEpoch,
        long sourceSessionId,
        long sourceSessionRevision,
        long selectedSceneToken,
        String normalizedQuery,
        Status status,
        List<Result> results,
        boolean hasMore,
        String message
) {

    public enum Status { IDLE, TOO_SHORT, SEARCHING, READY, FAILED }

    public SessionEncounterPlanSearchSnapshot {
        requestEpoch = Math.max(0L, requestEpoch);
        sourceSessionId = Math.max(0L, sourceSessionId);
        sourceSessionRevision = Math.max(0L, sourceSessionRevision);
        selectedSceneToken = Math.max(0L, selectedSceneToken);
        normalizedQuery = normalizedQuery == null ? "" : normalizedQuery.trim();
        status = status == null ? Status.IDLE : status;
        results = results == null ? List.of() : List.copyOf(results);
        message = message == null ? "" : message.trim();
        if (results.size() > 8) {
            throw new IllegalArgumentException("search publishes at most eight hydrated results");
        }
        if (status != Status.READY && (!results.isEmpty() || hasMore)) {
            throw new IllegalArgumentException("only READY search may publish results");
        }
    }

    @Override
    public List<Result> results() {
        return List.copyOf(results);
    }

    public static SessionEncounterPlanSearchSnapshot idle() {
        return new SessionEncounterPlanSearchSnapshot(0L, 0L, 0L, 0L, "", Status.IDLE, List.of(), false, "");
    }

    public record Result(
            long planId,
            String name,
            String summaryText,
            int adjustedXp,
            String difficultyLabel,
            String statusText,
            boolean attachEnabled
    ) {
        public Result {
            if (planId <= 0L) {
                throw new IllegalArgumentException("planId must be positive");
            }
            name = name == null ? "" : name.trim();
            summaryText = summaryText == null ? "" : summaryText.trim();
            adjustedXp = Math.max(0, adjustedXp);
            difficultyLabel = difficultyLabel == null ? "" : difficultyLabel.trim();
            statusText = statusText == null ? "" : statusText.trim();
        }
    }
}
