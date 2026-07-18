package features.creatures.adapter.javafx.details;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.creatures.api.CreatureDetail;
import features.creatures.api.CreatureDetailQueryApi;
import features.creatures.api.CreatureDetailResult;
import features.creatures.api.CreatureLookupStatus;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Labeled;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;

@org.junit.jupiter.api.Tag("ui")
final class CreatureInspectorSessionTest {

    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterAll
    static void shutdownFx() throws Exception {
        if (FX_STARTED.get()) {
            runOnFx(testsupport.JavaFxRuntime::shutdown);
        }
    }

    @Test
    void twoDelayedInspectorRequestsRemainBoundToTheirOwnCreatureIds() throws Exception {
        runOnFx(() -> {
            DelayedQueries queries = new DelayedQueries();
            CapturingInspector inspector = new CapturingInspector();
            new CreatureInspectorSession(queries, DirectUiDispatcher.INSTANCE, 11L).open(inspector);
            new CreatureInspectorSession(queries, DirectUiDispatcher.INSTANCE, 22L).open(inspector);
            Node first = inspector.entries.get(0).contentSupplier().get();
            Node second = inspector.entries.get(1).contentSupplier().get();

            queries.complete(22L, "Second Creature");
            queries.complete(11L, "First Creature");

            assertEquals(List.of(11L, 22L), queries.requested);
            assertEquals("creature:11", inspector.entries.get(0).entryKey());
            assertEquals("creature:22", inspector.entries.get(1).entryKey());
            assertTrue(texts(first).contains("First Creature"));
            assertTrue(texts(second).contains("Second Creature"));
            assertTrue(!texts(first).contains("Second Creature"));
            assertTrue(!texts(second).contains("First Creature"));
        });
    }

    private static List<String> texts(Node root) {
        List<String> result = new ArrayList<>();
        if (root instanceof Labeled labeled) {
            result.add(labeled.getText());
        }
        if (root instanceof Parent parent) {
            parent.getChildrenUnmodifiable().forEach(child -> result.addAll(texts(child)));
        }
        return List.copyOf(result);
    }

    private static CreatureDetail detail(long id, String name) {
        return new CreatureDetail(
                id, name, "Medium", "Humanoid", List.of(), List.of(), "Neutral", "1", 200, 10,
                "2d6", 2, 6, 0, 12, null,
                30, 0, 0, 0, 0,
                10, 10, 10, 10, 10, 10,
                0, 2,
                null, null, null, null, null, null, null, 10, null, 0, List.of());
    }

    private static void runOnFx(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrapped = () -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            testsupport.JavaFxRuntime.startup(wrapped);
        } else {
            Platform.runLater(wrapped);
        }
        assertTrue(latch.await(30, TimeUnit.SECONDS));
        if (failure[0] != null) {
            throw new AssertionError(failure[0]);
        }
    }

    private static final class DelayedQueries implements CreatureDetailQueryApi {
        private final List<Long> requested = new ArrayList<>();
        private final Map<Long, CompletableFuture<CreatureDetailResult>> futures = new HashMap<>();
        @Override public CompletableFuture<CreatureDetailResult> load(long creatureId) {
            requested.add(creatureId);
            CompletableFuture<CreatureDetailResult> future = new CompletableFuture<>();
            futures.put(creatureId, future);
            return future;
        }
        void complete(long id, String name) {
            futures.get(id).complete(new CreatureDetailResult(CreatureLookupStatus.SUCCESS, detail(id, name)));
        }
    }

    private static final class CapturingInspector implements InspectorSink {
        private final List<InspectorEntrySpec> entries = new ArrayList<>();
        @Override public void push(InspectorEntrySpec entry) { entries.add(entry); }
        @Override public void clear() { entries.clear(); }
        @Override public boolean isShowing(Object entryKey) { return false; }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
