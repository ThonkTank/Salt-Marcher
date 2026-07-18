package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import platform.ui.UiDispatcher;

final class CatalogWorkspaceBindingTest {

    @Test
    void attachIsSingleCurrentFirstLatestOnlyAndDetachable() {
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        CatalogWorkspacePublication publication = new CatalogWorkspacePublication(state(1L), dispatcher);
        CatalogWorkspaceBinding binding = new CatalogWorkspaceBinding(publication);
        List<Long> rendered = new ArrayList<>();

        binding.attach(value -> rendered.add(value.revision()));
        assertThrows(IllegalStateException.class, () -> binding.attach(ignored -> { }));
        publication.publish(state(2L));
        dispatcher.runAll();
        assertEquals(List.of(2L), rendered);

        binding.detach();
        publication.publish(state(3L));
        dispatcher.runAll();
        assertEquals(List.of(2L), rendered);
        binding.close();
    }

    private static CatalogWorkspaceState state(long revision) {
        return new CatalogWorkspaceState(
                revision, CatalogSectionId.MONSTERS, MonsterCatalogState.initial(), ItemsCatalogState.initial(),
                SavedEncounterCatalogState.initial(), WorldReferenceCatalogState.initial(),
                EncounterTableCatalogState.initial());
    }

    private static final class QueuedDispatcher implements UiDispatcher {
        private final ArrayDeque<Runnable> pending = new ArrayDeque<>();
        @Override public void dispatch(Runnable update) { pending.addLast(update); }
        private void runAll() { while (!pending.isEmpty()) { pending.removeFirst().run(); } }
    }
}
