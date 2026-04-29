package saltmarcher.architecture;

public interface ArchitectureRule {
    void check(ArchitectureContext context, ViolationSink violations);
}
