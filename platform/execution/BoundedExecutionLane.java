package platform.execution;

import java.util.Objects;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;

/** Fixed-size execution lane for independently schedulable bounded work. */
public final class BoundedExecutionLane implements ExecutionLane {

    private static final DiagnosticId TASK_FAILURE = new DiagnosticId("execution.task-failure");

    private final Diagnostics diagnostics;
    private final AtomicBoolean closed = new AtomicBoolean();
    private final ExecutorService executor;

    public BoundedExecutionLane(Diagnostics diagnostics, String threadName, int parallelism) {
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        String safeName = Objects.requireNonNull(threadName, "threadName").trim();
        if (safeName.isEmpty()) {
            throw new IllegalArgumentException("thread name must not be empty");
        }
        if (parallelism <= 0) {
            throw new IllegalArgumentException("parallelism must be positive");
        }
        AtomicInteger sequence = new AtomicInteger();
        executor = Executors.newFixedThreadPool(parallelism, task -> {
            Thread thread = new Thread(task, safeName + "-" + sequence.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        });
    }

    @Override
    public void execute(Runnable work) {
        Runnable safeWork = Objects.requireNonNull(work, "work");
        if (closed.get()) {
            throw new RejectedExecutionException("execution lane is closed");
        }
        executor.execute(() -> {
            try {
                safeWork.run();
            } catch (RuntimeException exception) {
                diagnostics.failure(TASK_FAILURE, exception.getClass());
            }
        });
    }

    @Override
    public void close() {
        if (closed.compareAndSet(false, true)) {
            executor.shutdown();
        }
        boolean interrupted = false;
        while (!executor.isTerminated()) {
            try {
                executor.awaitTermination(Long.MAX_VALUE, TimeUnit.NANOSECONDS);
            } catch (InterruptedException exception) {
                interrupted = true;
            }
        }
        if (interrupted) {
            Thread.currentThread().interrupt();
        }
    }

    public boolean terminateNow(Duration timeout) {
        Duration safeTimeout = Objects.requireNonNull(timeout, "timeout");
        if (safeTimeout.isNegative()) {
            throw new IllegalArgumentException("timeout must not be negative");
        }
        closed.set(true);
        executor.shutdownNow();
        long remaining = safeTimeout.toNanos();
        long started = System.nanoTime();
        boolean interrupted = false;
        while (!executor.isTerminated() && remaining > 0L) {
            try {
                executor.awaitTermination(remaining, TimeUnit.NANOSECONDS);
            } catch (InterruptedException exception) {
                interrupted = true;
            }
            remaining = safeTimeout.toNanos() - (System.nanoTime() - started);
        }
        if (interrupted) {
            Thread.currentThread().interrupt();
        }
        return executor.isTerminated();
    }
}
