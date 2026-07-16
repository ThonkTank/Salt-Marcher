package platform.execution;

import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;

public final class SerialExecutionLane implements ExecutionLane {

    private static final DiagnosticId TASK_FAILURE = new DiagnosticId("execution.task-failure");

    private final Diagnostics diagnostics;
    private final AtomicBoolean closed = new AtomicBoolean();
    private final AtomicReference<Thread> worker = new AtomicReference<>();
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
        if (interrupted) {
            Thread.currentThread().interrupt();
        }
    }
}
