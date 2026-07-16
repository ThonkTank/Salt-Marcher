package platform.execution;

public interface ExecutionLane extends AutoCloseable {

    void execute(Runnable work);

    @Override
    void close();
}
