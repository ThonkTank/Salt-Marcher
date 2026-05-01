package saltmarcher.architecture.domain.applicationservice;

import java.nio.file.Path;
import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ViolationSink;

public final class DomainApplicationServiceTopologyCheckMain {

    private DomainApplicationServiceTopologyCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]).normalize().toAbsolutePath());
        ViolationSink sink = new ViolationSink();
        new DomainApplicationServiceTopologyRules().check(context, sink);
        ArchitectureChecker.Result result = new ArchitectureChecker.Result(sink.violations().stream()
                .sorted(java.util.Comparator.comparing(ArchitectureChecker.Violation::source)
                        .thenComparing(ArchitectureChecker.Violation::rule)
                        .thenComparing(ArchitectureChecker.Violation::details))
                .toList());
        if (!result.isSuccess()) {
            System.err.println(result.render());
            System.exit(1);
        }

        System.out.println("Domain ApplicationService topology checks passed.");
    }
}
