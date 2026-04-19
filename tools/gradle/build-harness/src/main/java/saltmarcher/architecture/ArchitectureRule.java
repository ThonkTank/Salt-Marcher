package saltmarcher.architecture;

interface ArchitectureRule {
    void check(ArchitectureContext context, ViolationSink violations);
}
