package src.domain.encountertable;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.ui.UiDispatcher;
import src.domain.encountertable.model.catalog.EncounterTableCandidateData;
import src.domain.encountertable.model.catalog.EncounterTableSummaryData;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.RefreshEncounterTableCandidatesCommand;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;

final class EncounterTableRuntimeBoundaryTest {

    @Test
    void readsEnterTheLaneAndPublicationsUseTheUiDispatcher() {
        ControllableLane lane = new ControllableLane();
        QueuedUiDispatcher ui = new QueuedUiDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        RecordingPort port = new RecordingPort();
        EncounterTableServiceAssembly.Component component =
                EncounterTableServiceAssembly.create(port, lane, ui, diagnostics);
        List<EncounterTableReadStatus> observed = new ArrayList<>();
        component.catalog().subscribe(result -> observed.add(result.status()));

        component.application().refreshCatalog(new RefreshEncounterTableCatalogCommand());
        component.application().refreshCandidates(new RefreshEncounterTableCandidatesCommand(List.of(1L), 100));
        assertEquals(0, port.readCount, "construction and commands do not read on the caller");

        lane.runNext();
        assertEquals(1, port.readCount);
        assertEquals(List.of(), observed, "callback waits for UI dispatch");
        ui.runAll();
        assertEquals(List.of(EncounterTableReadStatus.SUCCESS), observed);

        lane.runNext();
        assertEquals(2, port.readCount);
        port.fail = true;
        component.application().refreshCatalog(new RefreshEncounterTableCatalogCommand());
        lane.runNext();
        assertEquals(EncounterTableReadStatus.STORAGE_ERROR, component.catalog().current().status());
        assertEquals(EncounterTableReadStatus.STORAGE_ERROR, component.references().catalog().status());
        assertEquals(
                List.of("encountertable.catalog.storage-failure", "encountertable.reference.storage-failure"),
                diagnostics.ids());
    }

    private static final class RecordingPort implements EncounterTableCatalogPort {

        private int readCount;
        private boolean fail;

        @Override
        public List<EncounterTableSummaryData> loadSummaries() {
            readCount++;
            if (fail) {
                throw new IllegalStateException("fixture payload must not reach diagnostics");
            }
            return List.of(new EncounterTableSummaryData(1L, "Ambush", null));
        }

        @Override
        public List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp) {
            readCount++;
            return List.of();
        }
    }

    private static final class ControllableLane implements ExecutionLane {

        private final List<Runnable> work = new ArrayList<>();

        @Override
        public void execute(Runnable task) {
            work.add(task);
        }

        void runNext() {
            work.removeFirst().run();
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
