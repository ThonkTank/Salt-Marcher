package saltmarcher.architecture.view.intenthandler;

import java.nio.file.Path;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewTopologyPerimeterRules;

public final class ViewIntentHandlerTopologyCheckMain {

    private ViewIntentHandlerTopologyCheckMain() {
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected exactly one argument: <repo-root>");
        }

        ArchitectureContext context = new ArchitectureContext(Path.of(args[0]).normalize().toAbsolutePath());
        ViolationSink sink = new ViolationSink();
        new ViewTopologyPerimeterRules().check(context, sink);
        new ViewIntentHandlerTopologyRules().check(context, sink);
        if (!sink.violations().isEmpty()) {
            System.err.println("ViewIntentHandler topology check failed with " + sink.violations().size() + " violation(s):");
            sink.violations().forEach(violation ->
                    System.err.println("- [" + violation.rule() + "] " + violation.source() + ": " + violation.details()));
            System.exit(1);
        }

        System.out.println("ViewIntentHandler topology checks passed.");
    }
}
