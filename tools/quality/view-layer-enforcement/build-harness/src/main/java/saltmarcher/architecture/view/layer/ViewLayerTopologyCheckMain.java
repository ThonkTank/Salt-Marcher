package saltmarcher.architecture.view.layer;

import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ViolationSink;

public final class ViewLayerTopologyCheckMain {

    private ViewLayerTopologyCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]).normalize().toAbsolutePath());
        ViolationSink sink = new ViolationSink();
        new ViewLayerTopologyRules().check(context, sink);
        List<ArchitectureChecker.Violation> ordered = sink.violations().stream()
                .sorted(Comparator.comparing(ArchitectureChecker.Violation::source)
                        .thenComparing(ArchitectureChecker.Violation::rule)
                        .thenComparing(ArchitectureChecker.Violation::details))
                .toList();
        if (!ordered.isEmpty()) {
            String body = ordered.stream()
                    .map(violation -> "- [" + violation.rule() + "] "
                            + violation.source() + ": " + violation.details())
                    .collect(Collectors.joining(System.lineSeparator()));
            System.err.println("View Layer topology check failed with " + ordered.size()
                    + " violation(s):" + System.lineSeparator() + body);
            System.exit(1);
        }

        System.out.println("View Layer topology checks passed.");
    }
}
