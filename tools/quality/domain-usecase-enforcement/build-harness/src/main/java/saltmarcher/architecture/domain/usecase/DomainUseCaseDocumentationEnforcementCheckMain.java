package saltmarcher.architecture.domain.usecase;

import java.nio.file.Path;
import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ViolationSink;

public final class DomainUseCaseDocumentationEnforcementCheckMain {

    private DomainUseCaseDocumentationEnforcementCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]).normalize().toAbsolutePath());
        ViolationSink sink = new ViolationSink();
        new DomainUseCaseEnforcementCoverageRules().check(context, sink);
        ArchitectureChecker.Result result = new ArchitectureChecker.Result(sink.violations().stream()
                .map(violation -> new ArchitectureChecker.Violation(
                        violation.source(),
                        violation.rule(),
                        violation.details()))
                .toList());
        if (!result.isSuccess()) {
            System.err.println(result.render());
            System.exit(1);
        }

        System.out.println("Domain UseCase documentation enforcement checks passed.");
    }
}
