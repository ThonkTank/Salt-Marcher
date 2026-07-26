package platform.execution;

import java.util.Objects;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;

public final class SerialExecutionLane implements ExecutionLane {

    public enum TerminationResult { TERMINATED, TIMED_OUT, INTERRUPTED }

    private static final DiagnosticId TASK_FAILURE = new DiagnosticId("execution.task-failure");

    private final Diagnostics diagnostics;
    private final AtomicBoolean closed = new AtomicBoolean();
    private final AtomicBoolean terminationWatcherStarted = new AtomicBoolean();
    private final AtomicReference<Thread> worker = new AtomicReference<>();
    private final CompletableFuture<Void> termination = new CompletableFuture<>();
    private final ExecutorService executor;

    public SerialExecutionLane(Diagnostics diagnostics) {
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        executor = Executors.newSingleThreadExecutor(task -> {
            Thread thread = new Thread(task, "salt-marcher-runtime");
            thread.setDaemon(true);
            worker.set(thread);
            return thread;
        });
    }

    @Override
    public void execute(Runnable work) {
        Runnable safeWork = Objects.requireNonNull(work, "work");
        if (Thread.currentThread() == worker.get()) {
            runSafely(safeWork);
            return;
        }
        if (closed.get()) {
            throw new RejectedExecutionException("execution lane is closed");
        }
        executor.execute(() -> runSafely(safeWork));
    }

    private void runSafely(Runnable work) {
        try {
            work.run();
        } catch (RuntimeException exception) {
            diagnostics.failure(TASK_FAILURE, exception.getClass());
        }
    }

    @Override
    public void close() {
        if (closed.compareAndSet(false, true)) {
            executor.shutdown();
        }
        if (Thread.currentThread() == worker.get()) {
            observeTermination();
            return;
        }

        boolean interrupted = false;
        while (!executor.isTerminated()) {
            try {
                executor.awaitTermination(Long.MAX_VALUE, TimeUnit.NANOSECONDS);
            } catch (InterruptedException exception) {
                interrupted = true;
            }
        }
        termination.complete(null);
        if (interrupted) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Terminal-shutdown path: rejects queued work, interrupts the running task, and waits only for
     * the supplied budget. The worker is daemon-owned, so a non-cooperative dependency cannot keep
     * the process alive after this method returns.
     */
    public TerminationResult terminateNow(Duration timeout) {
        Duration safeTimeout = Objects.requireNonNull(timeout, "timeout");
        if (safeTimeout.isNegative()) {
            throw new IllegalArgumentException("timeout must not be negative");
        }
        closed.set(true);
        executor.shutdownNow();
        if (Thread.currentThread() == worker.get()) {
            observeTermination();
            return executor.isTerminated()
                    ? TerminationResult.TERMINATED
                    : TerminationResult.TIMED_OUT;
        }
        long remaining = safeTimeout.toNanos();
        long started = System.nanoTime();
        boolean interrupted = false;
        try {
            while (!executor.isTerminated() && remaining > 0L) {
                try {
                    if (executor.awaitTermination(remaining, TimeUnit.NANOSECONDS)) {
                        break;
                    }
                } catch (InterruptedException interruption) {
                    interrupted = true;
                }
                remaining = safeTimeout.toNanos() - (System.nanoTime() - started);
            }
            if (interrupted) {
                return TerminationResult.INTERRUPTED;
            }
            return executor.isTerminated()
                    ? TerminationResult.TERMINATED
                    : TerminationResult.TIMED_OUT;
        } finally {
            observeTermination();
            if (interrupted) {
                Thread.currentThread().interrupt();
            }
        }
    }

    public CompletionStage<Void> termination() {
        observeTermination();
        return termination;
    }

    private void observeTermination() {
        if (executor.isTerminated()) {
            termination.complete(null);
            return;
        }
        if (!closed.get() || !terminationWatcherStarted.compareAndSet(false, true)) {
            return;
        }
        Thread watcher = new Thread(() -> {
            boolean interrupted = false;
            try {
                while (!executor.isTerminated()) {
                    try {
                        executor.awaitTermination(Long.MAX_VALUE, TimeUnit.NANOSECONDS);
                    } catch (InterruptedException interruption) {
                        interrupted = true;
                    }
                }
                termination.complete(null);
            } finally {
                if (interrupted) {
                    Thread.currentThread().interrupt();
                }
            }
        }, "salt-marcher-runtime-termination");
        watcher.setDaemon(true);
        watcher.start();
    }

    public boolean terminated() {
        return executor.isTerminated();
    }
}
