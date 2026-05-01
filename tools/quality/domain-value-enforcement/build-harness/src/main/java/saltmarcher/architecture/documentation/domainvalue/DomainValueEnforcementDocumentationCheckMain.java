package saltmarcher.architecture.documentation.domainvalue;

import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ViolationSink;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

public final class DomainValueEnforcementDocumentationCheckMain {

    private DomainValueEnforcementDocumentationCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]).normalize().toAbsolutePath());
        ViolationSink sink = new ViolationSink();
        new DomainValueEnforcementDocumentationRules().check(context, sink);
        List<ArchitectureChecker.Violation> ordered = sink.violations().stream()
                .sorted(Comparator.comparing(ArchitectureChecker.Violation::source)
                        .thenComparing(ArchitectureChecker.Violation::rule)
                        .thenComparing(ArchitectureChecker.Violation::details))
                .toList();
        ArchitectureChecker.Result result = new ArchitectureChecker.Result(ordered);
        if (!result.isSuccess()) {
            System.err.println(result.render());
            System.exit(1);
        }

        System.out.println("Domain value enforcement documentation checks passed.");
    }
}
