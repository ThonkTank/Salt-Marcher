package saltmarcher.architecture.layering;

import java.util.Comparator;
import java.nio.file.Path;
import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ViolationSink;

public final class LayeringArchitectureTopologyCheckMain {

    private LayeringArchitectureTopologyCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]));
        ViolationSink sink = new ViolationSink();
        new LayeringArchitectureTopologyRules().check(context, sink);
        ArchitectureChecker.Result result = new ArchitectureChecker.Result(
                sink.violations().stream()
                        .sorted(Comparator.comparing(ArchitectureChecker.Violation::source)
                                .thenComparing(ArchitectureChecker.Violation::rule)
                                .thenComparing(ArchitectureChecker.Violation::details))
                        .toList());
        if (!result.isSuccess()) {
            System.err.println(result.render());
            System.exit(1);
        }

        System.out.println("Layering architecture topology checks passed.");
    }
}
