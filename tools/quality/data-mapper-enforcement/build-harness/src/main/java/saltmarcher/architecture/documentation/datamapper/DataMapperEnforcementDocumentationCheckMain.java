package saltmarcher.architecture.documentation.datamapper;

import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ViolationSink;

public final class DataMapperEnforcementDocumentationCheckMain {

    private DataMapperEnforcementDocumentationCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]).normalize().toAbsolutePath());
        ViolationSink sink = new ViolationSink();
        new DataMapperEnforcementDocumentationRules().check(context, sink);
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

        System.out.println("Data mapper enforcement documentation checks passed.");
    }
}
