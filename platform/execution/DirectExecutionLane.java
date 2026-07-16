package platform.execution;

import java.util.Objects;

public enum DirectExecutionLane implements ExecutionLane {
    INSTANCE;

    @Override
    public void execute(Runnable work) {
        Objects.requireNonNull(work, "work").run();
    }

    @Override
    public void close() {
    }
}
