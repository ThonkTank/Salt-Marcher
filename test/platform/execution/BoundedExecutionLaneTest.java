package platform.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;

final class BoundedExecutionLaneTest {

    @Test
    void boundedLaneRunsIndependentWorkConcurrentlyOnExplicitlyNamedWorkers() throws Exception {
        Set<String> workers = ConcurrentHashMap.newKeySet();
        CountDownLatch started = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch completed = new CountDownLatch(2);
        try (BoundedExecutionLane lane = new BoundedExecutionLane(
                NoopDiagnostics.INSTANCE, "generation-cpu-proof", 2)) {
            for (int index = 0; index < 2; index++) {
                lane.execute(() -> {
                    workers.add(Thread.currentThread().getName());
                    started.countDown();
                    try {
                        release.await();
                    } catch (InterruptedException exception) {
                        Thread.currentThread().interrupt();
                    } finally {
                        completed.countDown();
                    }
                });
            }
            assertTrue(started.await(5, TimeUnit.SECONDS));
            release.countDown();
            assertTrue(completed.await(5, TimeUnit.SECONDS));
        }

        assertEquals(2, workers.size());
        assertTrue(workers.stream().allMatch(name -> name.startsWith("generation-cpu-proof-")));
    }

    @Test
    void closeRejectsNewWork() {
        BoundedExecutionLane lane = new BoundedExecutionLane(
                NoopDiagnostics.INSTANCE, "generation-io-proof", 1);
        lane.close();

        assertThrows(RejectedExecutionException.class, () -> lane.execute(() -> { }));
    }

    @Test
    void terminalCloseIsBoundedForNoncooperativeDaemonWorkAndCanFinishAfterRelease()
            throws Exception {
        BoundedExecutionLane lane = new BoundedExecutionLane(
                NoopDiagnostics.INSTANCE, "bounded-terminal-proof", 1);
        CountDownLatch entered = new CountDownLatch(1);
        java.util.concurrent.atomic.AtomicBoolean release =
                new java.util.concurrent.atomic.AtomicBoolean();
        java.util.concurrent.atomic.AtomicBoolean daemon =
                new java.util.concurrent.atomic.AtomicBoolean();
        lane.execute(() -> {
            daemon.set(Thread.currentThread().isDaemon());
            entered.countDown();
            while (!release.get()) {
                java.util.concurrent.locks.LockSupport.parkNanos(
                        TimeUnit.MILLISECONDS.toNanos(5));
                Thread.interrupted();
            }
        });
        assertTrue(entered.await(5, TimeUnit.SECONDS));

        long started = System.nanoTime();
        assertFalse(lane.terminateNow(java.time.Duration.ofMillis(50)));
        assertTrue(System.nanoTime() - started < TimeUnit.SECONDS.toNanos(1));
        assertTrue(daemon.get());
        assertThrows(RejectedExecutionException.class, () -> lane.execute(() -> { }));

        release.set(true);
        assertTrue(lane.terminateNow(java.time.Duration.ofSeconds(1)));
    }
}
