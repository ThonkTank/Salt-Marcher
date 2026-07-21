package features.encounter.application;

import features.encounter.api.SavedEncounterPlanSearchHit;
import features.encounter.api.SearchSavedEncounterPlansQuery;
import features.encounter.api.SearchSavedEncounterPlansResult;
import features.encounter.domain.plan.EncounterPlanSummary;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;
import platform.execution.ExecutionLane;

public final class SavedEncounterPlanSearchService {

    static final int MIN_QUERY_LENGTH = 2;
    static final int MAX_PUBLISHED_HITS = 8;
    private static final int ROOT_READ_LIMIT = MAX_PUBLISHED_HITS + 1;
    private static final String INVALID_MESSAGE = "Saved encounter search requires at least two characters.";
    private static final String STORAGE_MESSAGE = "Saved encounter search is unavailable.";
    private static final DiagnosticId SEARCH_READ = new DiagnosticId("encounter.saved-plan-search.read");

    private final SavedEncounterPlanSearchRepository repository;
    private final ExecutionLane ioLane;
    private final Diagnostics diagnostics;

    public SavedEncounterPlanSearchService(
            SavedEncounterPlanSearchRepository repository,
            ExecutionLane ioLane,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.ioLane = Objects.requireNonNull(ioLane, "ioLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    public CompletionStage<SearchSavedEncounterPlansResult> search(SearchSavedEncounterPlansQuery query) {
        if (query == null || query.normalizedQuery().length() < MIN_QUERY_LENGTH) {
            return CompletableFuture.completedFuture(SearchSavedEncounterPlansResult.failure(
                    SearchSavedEncounterPlansResult.Status.INVALID_REQUEST, INVALID_MESSAGE));
        }
        CompletableFuture<SearchSavedEncounterPlansResult> completion = new CompletableFuture<>();
        try {
            ioLane.execute(() -> searchOnLane(query.normalizedQuery(), completion));
        } catch (RuntimeException failure) {
            completion.complete(SearchSavedEncounterPlansResult.failure(
                    SearchSavedEncounterPlansResult.Status.STORAGE_FAILURE, STORAGE_MESSAGE));
        }
        return completion;
    }

    private void searchOnLane(String normalizedQuery, CompletableFuture<SearchSavedEncounterPlansResult> completion) {
        long startedNanos = System.nanoTime();
        try {
            SavedEncounterPlanSearchRepository.SearchRead read =
                    repository.searchSavedPlans(normalizedQuery, ROOT_READ_LIMIT);
            List<EncounterPlanSummary> roots = read.plans();
            boolean hasMore = roots.size() > MAX_PUBLISHED_HITS;
            List<SavedEncounterPlanSearchHit> hits = roots.stream()
                    .limit(MAX_PUBLISHED_HITS)
                    .map(SavedEncounterPlanSearchService::hit)
                    .toList();
            diagnostics.measurement(new Measurement(
                    SEARCH_READ, 0L, Math.max(0L, System.nanoTime() - startedNanos),
                    hits.size(), read.statementCount()));
            completion.complete(SearchSavedEncounterPlansResult.success(hits, hasMore));
        } catch (RuntimeException failure) {
            completion.complete(SearchSavedEncounterPlansResult.failure(
                    SearchSavedEncounterPlansResult.Status.STORAGE_FAILURE, STORAGE_MESSAGE));
        }
    }

    private static SavedEncounterPlanSearchHit hit(EncounterPlanSummary plan) {
        return new SavedEncounterPlanSearchHit(
                plan.id(), plan.name(), summaryText(plan.generatedLabel(), plan.creatureCount()));
    }

    private static String summaryText(String generatedLabel, int creatureCount) {
        StringBuilder text = new StringBuilder().append(Math.max(0, creatureCount)).append(" Kreaturen");
        String safeLabel = generatedLabel == null ? "" : generatedLabel.trim();
        if (!safeLabel.isBlank()) {
            text.append(" · ").append(safeLabel);
        }
        return text.toString();
    }
}
