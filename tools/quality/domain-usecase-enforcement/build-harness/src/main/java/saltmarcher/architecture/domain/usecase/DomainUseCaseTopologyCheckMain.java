package saltmarcher.architecture.domain.usecase;

import java.nio.file.Path;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ViolationSink;

public final class DomainUseCaseTopologyCheckMain {

    private DomainUseCaseTopologyCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]).normalize().toAbsolutePath());
        ViolationSink sink = new ViolationSink();
        new DomainUseCaseTopologyRules().check(context, sink);
        if (!sink.violations().isEmpty()) {
            System.err.println("Domain UseCase topology check failed with " + sink.violations().size() + " violation(s):");
            sink.violations().forEach(violation ->
                    System.err.println("- [" + violation.rule() + "] " + violation.source() + ": " + violation.details()));
            System.exit(1);
        }

        System.out.println("Domain UseCase topology checks passed.");
    }
}
