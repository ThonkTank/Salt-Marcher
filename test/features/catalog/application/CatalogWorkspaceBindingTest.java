package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicInteger;
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

    @Test
    void closeCommitsClosedStateWhenDetachThrowsAndDoesNotRetry() {
        AtomicInteger detachAttempts = new AtomicInteger();
        CatalogWorkspaceBinding binding = new CatalogWorkspaceBinding(observer -> () -> {
            detachAttempts.incrementAndGet();
            throw new IllegalStateException("detach failed");
        });
        binding.attach(ignored -> { });

        assertThrows(IllegalStateException.class, binding::close);
        assertEquals(1, detachAttempts.get());
        assertThrows(IllegalStateException.class, () -> binding.attach(ignored -> { }));

        binding.close();
        assertEquals(1, detachAttempts.get(), "closed binding must not retry a failed detach");
    }

    private static CatalogWorkspaceState state(long revision) {
        CatalogSectionDefinition<NoCatalogQuery, String, String> definition = new StubDefinition();
        CatalogSectionState<NoCatalogQuery, String, String> section = new CatalogSectionState<>(
                revision, CatalogSectionState.Lifecycle.INACTIVE, NoCatalogQuery.INSTANCE, NoCatalogQuery.INSTANCE,
                0L, 50, 0, 0,
                new CatalogSortOrder("value", CatalogSortOrder.Direction.ASCENDING),
                Optional.empty(), 0L, false, CatalogResultState.uninitialized());
        CatalogSectionCommands<NoCatalogQuery, String> commands = new CatalogSectionCommands<>(
                ignored -> { }, ignored -> { }, () -> { }, ignored -> { }, ignored -> { },
                ignored -> { }, (ignored, key) -> { },
                ignored -> { }, ignored -> { }, ignored -> { });
        return new CatalogWorkspaceState(revision, CatalogActiveSection.of(new CatalogSectionBinding<>(
                definition, section, commands, "", CatalogConfirmation.none())));
    }

    private static final class StubDefinition
            implements CatalogSectionDefinition<NoCatalogQuery, String, String> {
        @Override public CatalogSectionId id() { return CatalogSectionId.MONSTERS; }
        @Override public NoCatalogQuery initialQuery() { return NoCatalogQuery.INSTANCE; }
        @Override public CompletionStage<CatalogBrowseResult<NoCatalogQuery, String>> query(
                CatalogBrowseRequest<NoCatalogQuery> request
        ) {
            return CompletableFuture.completedFuture(CatalogBrowseResult.firstPage(
                    request.query(), CatalogResultState.ready(List.of()), 0L));
        }
        @Override public String key(String row) { return row; }
        @Override public CatalogPresentationSpec<NoCatalogQuery, String, String> presentation() {
            throw new UnsupportedOperationException("Binding test does not render its state.");
        }
    }

    private static final class QueuedDispatcher implements UiDispatcher {
        private final ArrayDeque<Runnable> pending = new ArrayDeque<>();
        @Override public void dispatch(Runnable update) { pending.addLast(update); }
        private void runAll() { while (!pending.isEmpty()) { pending.removeFirst().run(); } }
    }
}
