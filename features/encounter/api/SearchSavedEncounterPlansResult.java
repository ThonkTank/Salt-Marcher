package features.encounter.api;

import java.util.List;

public record SearchSavedEncounterPlansResult(
        Status status,
        List<SavedEncounterPlanSearchHit> hits,
        boolean hasMore,
        String message
) {

    public enum Status { SUCCESS, INVALID_REQUEST, STORAGE_FAILURE }

    public SearchSavedEncounterPlansResult {
        status = status == null ? Status.STORAGE_FAILURE : status;
        hits = hits == null ? List.of() : List.copyOf(hits);
        message = message == null ? "" : message.trim();
        if (hits.size() > 8) {
            throw new IllegalArgumentException("saved encounter search publishes at most eight hits");
        }
        if (status != Status.SUCCESS && (!hits.isEmpty() || hasMore)) {
            throw new IllegalArgumentException("failed search must not publish hits");
        }
    }

    @Override
    public List<SavedEncounterPlanSearchHit> hits() {
        return List.copyOf(hits);
    }

    public static SearchSavedEncounterPlansResult success(
            List<SavedEncounterPlanSearchHit> hits,
            boolean hasMore
    ) {
        return new SearchSavedEncounterPlansResult(Status.SUCCESS, hits, hasMore, "");
    }

    public static SearchSavedEncounterPlansResult failure(Status status, String message) {
        return new SearchSavedEncounterPlansResult(status, List.of(), false, message);
    }
}
