package platform.execution;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Coalesces replaceable work onto an owning execution lane.
 *
 * <p>At most one drain is pending. Samples submitted while the drain is
 * waiting replace the previous sample; samples submitted while work runs are
 * picked up by the same drain before it releases the lane.</p>
 */
public final class LatestWinsTaskQueue {
    private final ExecutionLane executionLane;
    private final AtomicReference<Runnable> latest = new AtomicReference<>();
    private final AtomicBoolean drainScheduled = new AtomicBoolean();

    public LatestWinsTaskQueue(ExecutionLane executionLane) {
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
    }

    public void submit(Runnable work) {
        latest.set(Objects.requireNonNull(work, "work"));
        if (drainScheduled.compareAndSet(false, true)) {
            executionLane.execute(this::drain);
        }
    }

    public boolean pending() {
        return drainScheduled.get();
    }

    private void drain() {
        try {
            Runnable work;
            while ((work = latest.getAndSet(null)) != null) {
                work.run();
            }
        } finally {
            drainScheduled.set(false);
            if (latest.get() != null && drainScheduled.compareAndSet(false, true)) {
                executionLane.execute(this::drain);
            }
        }
    }
}
