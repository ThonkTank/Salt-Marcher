package features.encounter.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.encounter.api.SearchSavedEncounterPlansQuery;
import features.encounter.api.SearchSavedEncounterPlansResult;
import features.encounter.domain.plan.EncounterPlanSummary;
import java.util.List;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;

final class SavedEncounterPlanSearchServiceTest {

    @Test
    void normalizesAndRejectsUnderLengthWithoutRepositoryRead() {
        RecordingRepository repository = new RecordingRepository();
        SavedEncounterPlanSearchService service = new SavedEncounterPlanSearchService(
                repository, DirectExecutionLane.INSTANCE, NoopDiagnostics.INSTANCE);

        SearchSavedEncounterPlansResult result = service.search(new SearchSavedEncounterPlansQuery(" A "))
                .toCompletableFuture().join();

        assertEquals(SearchSavedEncounterPlansResult.Status.INVALID_REQUEST, result.status());
        assertEquals(0, repository.reads);
        assertTrue(result.hits().isEmpty());
        assertFalse(result.hasMore());
    }

    @Test
    void readsNineRootsAndPublishesOnlyEightThinHitsWithHasMore() {
        RecordingRepository repository = new RecordingRepository();
        SavedEncounterPlanSearchService service = new SavedEncounterPlanSearchService(
                repository, DirectExecutionLane.INSTANCE, NoopDiagnostics.INSTANCE);

        SearchSavedEncounterPlansResult result = service.search(new SearchSavedEncounterPlansQuery(" PLAN "))
                .toCompletableFuture().join();

        assertEquals(SearchSavedEncounterPlansResult.Status.SUCCESS, result.status());
        assertEquals("plan", repository.query);
        assertEquals(9, repository.limit);
        assertEquals(8, result.hits().size());
        assertTrue(result.hasMore());
        assertEquals("1 Kreaturen · Generated 1", result.hits().getFirst().summaryText());
    }

    private static final class RecordingRepository implements SavedEncounterPlanSearchRepository {
        private int reads;
        private String query = "";
        private int limit;

        @Override
        public SearchRead searchSavedPlans(String normalizedQuery, int rootLimit) {
            reads++;
            query = normalizedQuery;
            limit = rootLimit;
            return new SearchRead(java.util.stream.LongStream.rangeClosed(1L, 9L)
                    .mapToObj(id -> new EncounterPlanSummary(
                            id, "Plan " + id, "Generated " + id, 1))
                    .toList(), 1);
        }
    }
}
