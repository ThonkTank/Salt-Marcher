package platform.ui;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import javafx.application.Platform;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import testsupport.JavaFxRuntime;

final class JavaFxUiDispatcherTest {

    @BeforeAll
    static void startJavaFx() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        JavaFxRuntime.startup(started::countDown);
        assertTrue(started.await(5L, TimeUnit.SECONDS));
    }

    @Test
    void dispatchesWorkerUpdatesExactlyOnceOnJavaFxThread() throws Exception {
        JavaFxUiDispatcher dispatcher = new JavaFxUiDispatcher();
        CountDownLatch finished = new CountDownLatch(1);
        List<Boolean> fxThreads = new ArrayList<>();

        Thread worker = new Thread(() -> dispatcher.dispatch(() -> {
            fxThreads.add(Platform.isFxApplicationThread());
            finished.countDown();
        }));
        worker.start();
        worker.join();

        assertTrue(finished.await(5L, TimeUnit.SECONDS));
        assertEquals(List.of(true), fxThreads);
    }

    @Test
    void queuedThrowingTerminalHandlerCompletesReturnedStageOnce() throws Exception {
        JavaFxUiDispatcher dispatcher = new JavaFxUiDispatcher();
        IllegalArgumentException handlerFailure = new IllegalArgumentException("handler failed");
        AtomicInteger updates = new AtomicInteger();
        AtomicInteger handlerCalls = new AtomicInteger();
        AtomicInteger completions = new AtomicInteger();

        var terminal = dispatcher.dispatchTracked(
                updates::incrementAndGet,
                ignored -> {
                    handlerCalls.incrementAndGet();
                    throw handlerFailure;
                }).toCompletableFuture();
        terminal.whenComplete((ignored, failure) -> completions.incrementAndGet());

        ExecutionException reported = assertThrows(
                ExecutionException.class,
                () -> terminal.get(5L, TimeUnit.SECONDS));
        assertSame(handlerFailure, reported.getCause());
        assertEquals(1, updates.get());
        assertEquals(1, handlerCalls.get());
        assertEquals(1, completions.get());
    }

    @Test
    void synchronousFxThreadHandlerFailureStillReturnsItsTerminalStage() throws Exception {
        JavaFxUiDispatcher dispatcher = new JavaFxUiDispatcher();
        IllegalArgumentException handlerFailure = new IllegalArgumentException("handler failed");
        AtomicReference<java.util.concurrent.CompletableFuture<Void>> returned =
                new AtomicReference<>();
        AtomicReference<Throwable> escaped = new AtomicReference<>();
        CountDownLatch submitted = new CountDownLatch(1);

        Platform.runLater(() -> {
            try {
                returned.set(dispatcher.dispatchTracked(
                        () -> { },
                        ignored -> { throw handlerFailure; }).toCompletableFuture());
            } catch (Throwable failure) {
                escaped.set(failure);
            } finally {
                submitted.countDown();
            }
        });

        assertTrue(submitted.await(5L, TimeUnit.SECONDS));
        assertNull(escaped.get());
        CompletionException reported = assertThrows(
                CompletionException.class,
                () -> returned.get().join());
        assertSame(handlerFailure, reported.getCause());
    }

    @Test
    void synchronousSchedulerRejectionNotifiesTerminalExactlyOnceAndReturnsFailedStage() {
        IllegalStateException rejection = new IllegalStateException("scheduler rejected");
        JavaFxUiDispatcher dispatcher = new JavaFxUiDispatcher(update -> { throw rejection; });
        AtomicInteger updates = new AtomicInteger();
        AtomicInteger terminalCalls = new AtomicInteger();
        AtomicReference<Throwable> observed = new AtomicReference<>();

        var terminal = dispatcher.dispatchTracked(
                updates::incrementAndGet,
                failure -> {
                    terminalCalls.incrementAndGet();
                    observed.set(failure);
                }).toCompletableFuture();

        CompletionException reported = assertThrows(CompletionException.class, terminal::join);
        assertSame(rejection, reported.getCause());
        assertSame(rejection, observed.get());
        assertEquals(0, updates.get());
        assertEquals(1, terminalCalls.get());
    }
}
