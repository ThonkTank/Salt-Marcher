package features.creatures.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.creatures.CreaturesServiceAssembly;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.ui.UiDispatcher;
import features.creatures.domain.catalog.CreatureCatalogData;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.creatures.api.CreatureLookupStatus;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureCatalogQuery;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReferenceIndexStatus;
import features.creatures.api.RefreshCreatureReferenceIndexCommand;

final class CreaturesRuntimeBoundaryTest {

    @Test
    void independentQueriesCompleteWithTheirOwnResultsAndReferenceIndexPublishesThroughUi() {
        ControllableLane lane = new ControllableLane();
        QueuedUiDispatcher ui = new QueuedUiDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        RecordingPort port = new RecordingPort();
        CreaturesServiceAssembly.Component component =
                CreaturesServiceAssembly.create(port, lane, lane, ui, diagnostics);
        CompletionStage<CreatureCatalogPageResult> older = component.catalogQueries().search(command("older"));
        CompletionStage<CreatureCatalogPageResult> newer = component.catalogQueries().search(command("newer"));

        assertEquals(0, port.searchCount, "queries do not touch storage on the caller");
        lane.run(1);
        assertEquals("newer", firstName(newer.toCompletableFuture().join()));
        assertEquals(false, older.toCompletableFuture().isDone(), "older request remains independently pending");
        lane.run(0);
        assertEquals("older", firstName(older.toCompletableFuture().join()));
        assertEquals(0, ui.size(), "request/response queries do not publish global UI state");

        CompletionStage<CreatureCatalogPageResult> failed = component.catalogQueries().search(command("fail"));
        lane.run(0);
        assertEquals(CreatureQueryStatus.STORAGE_ERROR, failed.toCompletableFuture().join().status());

        List<CreatureReferenceIndexStatus> observed = new ArrayList<>();
        component.referenceIndex().subscribe(result -> observed.add(result.status()));
        component.application().refreshReferenceIndex(new RefreshCreatureReferenceIndexCommand());
        component.application().refreshReferenceIndex(new RefreshCreatureReferenceIndexCommand());
        assertEquals(CreatureReferenceIndexStatus.LOADING, component.referenceIndex().current().status());
        assertEquals(2L, component.referenceIndex().current().revision());
        lane.run(1);
        assertEquals(CreatureReferenceIndexStatus.SUCCESS, component.referenceIndex().current().status());
        assertEquals(2L, component.referenceIndex().current().revision());
        lane.run(0);
        assertEquals(2L, component.referenceIndex().current().revision(), "stale index completion is ignored");
        assertEquals(List.of(), observed, "reference callbacks wait for UI dispatch");
        ui.runAll();
        assertEquals(List.of(CreatureReferenceIndexStatus.SUCCESS), observed,
                "queued UI publication coalesces to the latest immutable index");

        port.failDetail = true;
        assertEquals(CreatureLookupStatus.STORAGE_ERROR, component.references().find(7L).status());
        assertEquals(
                List.of("creatures.catalog.storage-failure", "creatures.reference.storage-failure"),
                diagnostics.ids());
    }

    private static CreatureCatalogQuery command(String query) {
        return new CreatureCatalogQuery(
                query,
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                50,
                0);
    }

    private static String firstName(features.creatures.api.CreatureCatalogPageResult result) {
        return result.page().rows().isEmpty() ? "" : result.page().rows().getFirst().name();
    }

    private static final class RecordingPort implements CreatureCatalogPort {

        private int searchCount;
        private boolean failDetail;

        @Override
        public CreatureCatalogData.DistinctFilterValues loadFilterValues() {
            return CreatureCatalogData.emptyFilterValues();
        }

        @Override
        public CreatureCatalogData.CatalogPageData searchCatalog(CreatureCatalogData.CatalogSearchSpec spec) {
            searchCount++;
            if ("fail".equals(spec.nameQuery())) {
                throw new IllegalStateException("fixture payload must not reach diagnostics");
            }
            return new CreatureCatalogData.CatalogPageData(
                    List.of(new CreatureCatalogData.CatalogRowData(
                            searchCount,
                            spec.nameQuery(),
                            "Medium",
                            "Humanoid",
                            "N",
                            "1",
                            200,
                            10,
                            12)),
                    1,
                    spec.pageSize(),
                    spec.pageOffset());
        }

        @Override
        public CreatureCatalogData.CreatureProfile loadCreatureDetail(long creatureId) {
            if (failDetail) {
                throw new IllegalStateException("fixture payload must not reach diagnostics");
            }
            return null;
        }

        @Override
        public List<CreatureCatalogData.EncounterCandidateProfile> loadEncounterCandidates(
                CreatureCatalogData.EncounterCandidateSpec spec
        ) {
            return List.of();
        }

        @Override
        public List<CreatureCatalogData.EncounterCandidateProfile> loadCreatureFacts(
                CreatureCatalogData.CreatureFactsSpec spec
        ) {
            return List.of();
        }
    }

    private static final class ControllableLane implements ExecutionLane {

        private final List<Runnable> work = new ArrayList<>();

        @Override
        public void execute(Runnable task) {
            work.add(task);
        }

        void run(int index) {
            work.remove(index).run();
        }

        @Override
        public void close() {
        }
    }

    private static final class QueuedUiDispatcher implements UiDispatcher {

        private final List<Runnable> updates = new ArrayList<>();

        @Override
        public void dispatch(Runnable update) {
            updates.add(update);
        }

        int size() {
            return updates.size();
        }

        void runAll() {
            List.copyOf(updates).forEach(Runnable::run);
            updates.clear();
        }
    }

    private static final class RecordingDiagnostics implements Diagnostics {

        private final List<String> ids = new ArrayList<>();

        @Override
        public void failure(DiagnosticId id, Class<? extends Throwable> failureType) {
            ids.add(id.value());
        }

        List<String> ids() {
            return List.copyOf(ids);
        }
    }
}
