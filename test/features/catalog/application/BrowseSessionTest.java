package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;

final class BrowseSessionTest {

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    @AfterEach
    void closeScheduler() {
        scheduler.shutdownNow();
    }

    @Test
    void activationQueriesOnlyThisSessionAndDeactivationInvalidatesLateResults() {
        Definition definition = new Definition(CatalogSectionId.MONSTERS);
        BrowseSession<String, Row, Long> session = session(definition, Duration.ofMillis(200));

        assertEquals(0, definition.requests.size());
        assertEquals(0, definition.subscriptions);

        session.activate();
        assertEquals(1, definition.requests.size());
        assertEquals(1, definition.subscriptions);
        CompletableFuture<CatalogBrowseResult<String, Row>> late = definition.results.getFirst();

        session.deactivate();
        late.complete(result("", 1L));

        assertEquals(CatalogResultState.Status.LOADING, session.state().result().status());
        assertEquals(0, definition.subscriptions);
        assertTrue(session.state().stale());
    }

    @Test
    void newestImmediateRequestWinsAndStableSelectionSurvivesRefresh() {
        Definition definition = new Definition(CatalogSectionId.MONSTERS);
        BrowseSession<String, Row, Long> session = session(definition, Duration.ZERO);
        session.activate();
        definition.results.getFirst().complete(result("", 7L));
        session.select(7L);

        session.editDraft("older");
        session.submit();
        CompletableFuture<CatalogBrowseResult<String, Row>> older = definition.results.getLast();
        session.editDraft("newer");
        session.submit();
        CompletableFuture<CatalogBrowseResult<String, Row>> newer = definition.results.getLast();

        newer.complete(result("newer", 7L));
        older.complete(result("older", 8L));

        assertEquals("newer", session.state().committedQuery());
        assertEquals(List.of(7L), session.state().result().rows().stream().map(Row::id).toList());
        assertEquals(7L, session.state().selectedKey().orElseThrow());
        assertFalse(session.state().stale());
    }

    @Test
    void rapidDraftEditsDebounceToOneFinalRequestAndProviderChangesRefreshOnlyWhileActive()
            throws InterruptedException {
        Definition definition = new Definition(CatalogSectionId.ITEMS);
        BrowseSession<String, Row, Long> session = session(definition, Duration.ofMillis(40));
        session.activate();
        definition.results.getFirst().complete(result("", 1L));

        session.editDraft("a");
        session.editDraft("ab");
        session.editDraft("abc");
        waitUntil(() -> definition.requests.size() == 2);

        assertEquals("abc", definition.requests.getLast().query());
        definition.emitInvalidation();
        assertEquals(3, definition.requests.size());
        session.deactivate();
        definition.emitInvalidation();
        assertEquals(3, definition.requests.size());
    }

    private BrowseSession<String, Row, Long> session(Definition definition, Duration debounce) {
        return new BrowseSession<>(
                definition, DirectUiDispatcher.INSTANCE, scheduler, debounce, () -> { });
    }

    private static CatalogBrowseResult<String, Row> result(String query, long id) {
        return new CatalogBrowseResult<>(query, CatalogResultState.ready(List.of(new Row(id))),
                0, 1, id);
    }

    private static void waitUntil(java.util.function.BooleanSupplier condition) throws InterruptedException {
        long deadline = System.nanoTime() + Duration.ofSeconds(2).toNanos();
        while (!condition.getAsBoolean() && System.nanoTime() < deadline) {
            Thread.sleep(5L);
        }
        assertTrue(condition.getAsBoolean());
    }

    private record Row(long id) { }

    private static final class Definition implements CatalogSectionDefinition<String, Row, Long> {
        private final CatalogSectionId id;
        private final List<CatalogBrowseRequest<String>> requests = new ArrayList<>();
        private final List<CompletableFuture<CatalogBrowseResult<String, Row>>> results = new ArrayList<>();
        private Consumer<CatalogProviderChange<String>> listener = ignored -> { };
        private int subscriptions;

        private Definition(CatalogSectionId id) {
            this.id = id;
        }

        @Override public CatalogSectionId id() { return id; }
        @Override public String initialQuery() { return ""; }
        @Override public Long key(Row row) { return row.id(); }
        @Override public CatalogPresentationSpec<String, Row, Long> presentation() {
            return new CatalogPresentationSpec<>("Test", "Rows", row -> Long.toString(row.id()),
                    List.of(), List.of(new CatalogColumnSpec<>("Id", row -> Long.toString(row.id()))),
                    java.util.Optional.empty(), List.of(), List.of(), false);
        }

        @Override
        public CompletableFuture<CatalogBrowseResult<String, Row>> query(CatalogBrowseRequest<String> request) {
            requests.add(request);
            CompletableFuture<CatalogBrowseResult<String, Row>> result = new CompletableFuture<>();
            results.add(result);
            return result;
        }

        @Override
        public Runnable observeProvider(Consumer<CatalogProviderChange<String>> next) {
            subscriptions++;
            listener = next;
            return () -> {
                subscriptions--;
                listener = ignored -> { };
            };
        }

        private void emitInvalidation() {
            listener.accept(CatalogProviderChange.invalidated());
        }
    }
}
