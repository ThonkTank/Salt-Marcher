package platform.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import platform.diagnostics.Diagnostics;

final class SerialExecutionLaneTest {

    @Test
    void runsOffCallerInFifoOrderAndKeepsNestedWorkInline() throws Exception {
        List<Integer> order = new ArrayList<>();
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch finished = new CountDownLatch(1);
        Thread caller = Thread.currentThread();
        List<Thread> observed = new ArrayList<>();
        SerialExecutionLane lane = new SerialExecutionLane(noopDiagnostics());
        try {
            lane.execute(() -> {
                observed.add(Thread.currentThread());
                await(release);
                order.add(1);
                lane.execute(() -> order.add(2));
            });
            lane.execute(() -> {
                order.add(3);
                finished.countDown();
            });

            assertTrue(order.isEmpty());
            release.countDown();
            assertTrue(finished.await(5L, TimeUnit.SECONDS));
            assertFalse(observed.getFirst() == caller);
            assertEquals(List.of(1, 2, 3), order);
        } finally {
            lane.close();
        }
    }

    @Test
    void reportsFailureContinuesAndRejectsAfterClose() throws Exception {
        List<Class<? extends Throwable>> failures = new ArrayList<>();
        CountDownLatch continued = new CountDownLatch(1);
        SerialExecutionLane lane = new SerialExecutionLane((id, type) -> failures.add(type));
        lane.execute(() -> {
            throw new IllegalStateException("payload must not reach diagnostics");
        });
        lane.execute(continued::countDown);

        assertTrue(continued.await(5L, TimeUnit.SECONDS));
        lane.close();
        assertEquals(List.of(IllegalStateException.class), failures);
        assertThrows(RejectedExecutionException.class, () -> lane.execute(() -> { }));
    }

    @Test
    void closeRejectsExternalWorkAndPreservesAcceptedWorkWhenTheCloserIsInterrupted() throws Exception {
        CountDownLatch outerStarted = new CountDownLatch(1);
        CountDownLatch releaseOuter = new CountDownLatch(1);
        CountDownLatch queuedFinished = new CountDownLatch(1);
        AtomicBoolean workerInterrupted = new AtomicBoolean();
        AtomicBoolean closerInterruptPreserved = new AtomicBoolean();
        SerialExecutionLane lane = new SerialExecutionLane(noopDiagnostics());
        lane.execute(() -> {
            outerStarted.countDown();
            try {
                releaseOuter.await();
            } catch (InterruptedException exception) {
                workerInterrupted.set(true);
                Thread.currentThread().interrupt();
            }
        });
        lane.execute(queuedFinished::countDown);
        assertTrue(outerStarted.await(5L, TimeUnit.SECONDS));

        Thread closer = new Thread(() -> {
            lane.close();
            closerInterruptPreserved.set(Thread.currentThread().isInterrupted());
        });
        closer.start();
        try {
            awaitExternalRejection(lane);
            closer.interrupt();
            assertTrue(closer.isAlive(), "interruption must not abandon the accepted queue");
            releaseOuter.countDown();

            assertTrue(queuedFinished.await(5L, TimeUnit.SECONDS));
            closer.join(TimeUnit.SECONDS.toMillis(5L));
            assertFalse(closer.isAlive());
            assertFalse(workerInterrupted.get(), "closing must not interrupt active work");
            assertTrue(closerInterruptPreserved.get(), "the closer interrupt status must be restored after draining");
        } finally {
            releaseOuter.countDown();
            closer.join(TimeUnit.SECONDS.toMillis(5L));
            lane.close();
        }
    }

    @Test
    void closeFromTheWorkerDoesNotDeadlockAndAcceptedWorkStillDrains() throws Exception {
        CountDownLatch allowWorkerClose = new CountDownLatch(1);
        CountDownLatch nestedFinished = new CountDownLatch(1);
        CountDownLatch queuedFinished = new CountDownLatch(1);
        SerialExecutionLane lane = new SerialExecutionLane(noopDiagnostics());
        lane.execute(() -> {
            await(allowWorkerClose);
            lane.close();
            lane.execute(nestedFinished::countDown);
        });
        lane.execute(queuedFinished::countDown);

        allowWorkerClose.countDown();

        assertTrue(nestedFinished.await(5L, TimeUnit.SECONDS));
        assertTrue(queuedFinished.await(5L, TimeUnit.SECONDS));
        assertThrows(RejectedExecutionException.class, () -> lane.execute(() -> { }));
        lane.close();
    }

    private static Diagnostics noopDiagnostics() {
        return (id, type) -> { };
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("test interrupted");
        }
    }

    private static void awaitExternalRejection(SerialExecutionLane lane) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5L);
        while (System.nanoTime() < deadline) {
            try {
                lane.execute(() -> { });
                Thread.yield();
            } catch (RejectedExecutionException expected) {
                return;
            }
        }
        throw new AssertionError("execution lane kept accepting external work after close began");
    }
}
