package src.domain.creatures;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.ui.UiDispatcher;
import src.domain.creatures.model.catalog.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.RefreshCreatureCatalogCommand;

final class CreaturesRuntimeBoundaryTest {

    @Test
    void catalogWorkIsQueuedDispatchedAndLatestRequestWins() {
        ControllableLane lane = new ControllableLane();
        QueuedUiDispatcher ui = new QueuedUiDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        RecordingPort port = new RecordingPort();
        CreaturesServiceAssembly.Component component =
                CreaturesServiceAssembly.create(port, lane, ui, diagnostics);
        List<String> observedNames = new ArrayList<>();
        component.catalog().subscribe(result -> observedNames.add(firstName(result)));

        component.application().refreshCatalog(command("older"));
        component.application().refreshCatalog(command("newer"));

        assertEquals(0, port.searchCount, "commands do not touch storage on the caller");
        lane.run(1);
        assertEquals("newer", firstName(component.catalog().current()), "newer completion is current");
        assertEquals(List.of(), observedNames, "publication callback waits for UI dispatch");
        lane.run(0);
        assertEquals("newer", firstName(component.catalog().current()), "older completion cannot replace newer state");
        assertEquals(1, ui.size(), "stale completion does not enqueue another UI update");

        ui.runAll();
        assertEquals(List.of("newer"), observedNames, "callback runs through the supplied UI dispatcher");

        component.application().refreshCatalog(command("fail"));
        lane.run(0);
        assertEquals(CreatureQueryStatus.STORAGE_ERROR, component.catalog().current().status());
        port.failDetail = true;
        assertEquals(CreatureLookupStatus.STORAGE_ERROR, component.references().find(7L).status());
        assertEquals(
                List.of("creatures.catalog.storage-failure", "creatures.reference.storage-failure"),
                diagnostics.ids());
    }

    private static RefreshCreatureCatalogCommand command(String query) {
        return new RefreshCreatureCatalogCommand(
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

    private static String firstName(src.domain.creatures.published.CreatureCatalogPageResult result) {
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
